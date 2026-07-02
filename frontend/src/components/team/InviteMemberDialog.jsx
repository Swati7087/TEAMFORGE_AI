import { useEffect, useMemo, useState } from "react";
import * as userApi from "../../api/user.api";
import * as teamApi from "../../api/team.api";

// Owner-only dialog. Lists every user in the system minus:
//  - the current owner
//  - anyone already a member
//  - anyone with an existing pending invite/request/accepted entry
// Click a user → send invite. Auto-refreshes the caller when a change is made.
export default function InviteMemberDialog({
  projectId,
  currentUserId,
  members = [],
  teamEntries = [],
  onClose,
  onInvited,
}) {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    userApi
      .getUsers()
      .then((data) => setUsers(data || []))
      .catch((err) =>
        setError(err?.response?.data?.message || err.message || "Failed to load users")
      )
      .finally(() => setLoading(false));
  }, []);

  // Fold together "already known to this project" IDs so we can filter them
  // out of the candidate list.
  const knownIds = useMemo(() => {
    const s = new Set();
    if (currentUserId) s.add(String(currentUserId));
    members.forEach((m) => s.add(String(m._id || m)));
    teamEntries.forEach((e) => {
      const uid = e.user?._id || e.user;
      if (uid) s.add(String(uid));
    });
    return s;
  }, [currentUserId, members, teamEntries]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return users
      .filter((u) => !knownIds.has(String(u._id)))
      .filter((u) => {
        if (!needle) return true;
        return (
          u.name?.toLowerCase().includes(needle) ||
          u.email?.toLowerCase().includes(needle)
        );
      });
  }, [users, knownIds, q]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const invite = async (userId) => {
    setBusyId(userId);
    setError(null);
    try {
      await teamApi.inviteToTeam(projectId, { userId });
      onInvited?.();
    } catch (err) {
      setError(
        err?.response?.data?.message || err.message || "Invite failed"
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className="relative w-full max-w-md">
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-green-500/30 via-transparent to-pink-500/30 opacity-60 blur-sm pointer-events-none" />

        <div className="relative bg-[#0a0a12]/85 backdrop-blur-md border border-white/[0.12] rounded-2xl p-6 shadow-2xl max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Invite a teammate</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-500 hover:text-white w-8 h-8 rounded flex items-center justify-center hover:bg-white/5"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or email"
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-green-400/50 mb-3"
            autoFocus
          />

          {error && (
            <p className="text-xs text-pink-400 bg-pink-500/10 border border-pink-500/20 rounded px-3 py-2 mb-3">
              {error}
            </p>
          )}

          <div className="flex-1 overflow-y-auto min-h-[120px] -mx-2 px-2">
            {loading ? (
              <p className="text-xs text-gray-500 text-center py-8">Loading users…</p>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-8 italic">
                No matching users
              </p>
            ) : (
              <ul className="space-y-1">
                {filtered.map((u) => (
                  <li
                    key={u._id}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.03]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-green-500/30 to-pink-500/30 border border-white/10 flex items-center justify-center text-xs font-bold text-white">
                        {u.name?.charAt(0)?.toUpperCase() || "?"}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm text-white truncate">{u.name}</div>
                        <div className="text-[11px] text-gray-500 truncate">{u.email}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => invite(u._id)}
                      disabled={busyId === u._id}
                      className="text-[11px] font-semibold tracking-wider uppercase text-green-300 hover:text-green-200 px-3 py-1.5 rounded-md border border-green-400/30 hover:border-green-400/50 hover:bg-green-400/5 transition-colors disabled:opacity-50"
                    >
                      {busyId === u._id ? "…" : "Invite"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
