import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProject } from "../hooks/useProjects";
import { useTasks } from "../hooks/useTasks";
import * as projectApi from "../api/project.api";
import * as teamApi from "../api/team.api";
import KanbanBoard from "../components/task/KanbanBoard";
import InviteMemberDialog from "../components/team/InviteMemberDialog";

const STATUS_STYLE = {
  planning: {
    dot: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]",
    label: "text-amber-300 border-amber-400/30 bg-amber-400/5",
  },
  "in-progress": {
    dot: "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.7)]",
    label: "text-green-300 border-green-400/30 bg-green-400/5",
  },
  completed: {
    dot: "bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.7)]",
    label: "text-pink-300 border-pink-500/30 bg-pink-500/5",
  },
};

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "team", label: "Team" },
  { id: "tasks", label: "Tasks" },
];

export default function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { project, loading, error, refetch } = useProject(id);
  const {
    tasks,
    moveTask,
    createTask,
    updateTask,
    deleteTask,
  } = useTasks(id);

  const [tab, setTab] = useState("overview");
  const [team, setTeam] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(null);

  const currentUserId = user?._id || user?.id;
  const ownerId = project?.owner?._id || project?.owner;
  const isOwner = useMemo(
    () => !!(currentUserId && ownerId && String(currentUserId) === String(ownerId)),
    [currentUserId, ownerId]
  );
  const isMember = useMemo(() => {
    if (!project || !currentUserId) return false;
    return project.members?.some(
      (m) => String(m._id || m) === String(currentUserId)
    );
  }, [project, currentUserId]);

  const loadTeam = async () => {
    try {
      const t = await teamApi.getTeamForProject(id);
      setTeam(t);
    } catch {
      // getTeamForProject 403s for non-members, which is fine here.
      setTeam(null);
    }
  };

  useEffect(() => {
    if (!project) return;
    if (isOwner || isMember) loadTeam();
  }, [project, isOwner, isMember]); // eslint-disable-line react-hooks/exhaustive-deps

  const showFlash = (msg, type = "info") => {
    setFlash({ msg, type });
    setTimeout(() => setFlash(null), 3000);
  };

  const handleRequestJoin = async () => {
    setBusy(true);
    try {
      await teamApi.requestToJoin(id);
      showFlash("Join request submitted. Waiting on the owner.", "info");
      loadTeam();
    } catch (err) {
      showFlash(
        err?.response?.data?.message || "Failed to submit request",
        "error"
      );
    } finally {
      setBusy(false);
    }
  };

  const respondTo = async (userId, status) => {
    setBusy(true);
    try {
      await teamApi.respondToInvite(id, { userId, status });
      showFlash(
        status === "accepted" ? "Request accepted" : "Request rejected",
        "info"
      );
      await Promise.all([loadTeam(), refetch()]);
    } catch (err) {
      showFlash(
        err?.response?.data?.message || "Failed to respond",
        "error"
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm("Remove this member from the project?")) return;
    setBusy(true);
    try {
      await teamApi.removeMember(id, userId);
      await Promise.all([loadTeam(), refetch()]);
    } catch (err) {
      showFlash(err?.response?.data?.message || "Failed to remove", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!window.confirm("Delete this project? All tasks will be removed.")) return;
    setBusy(true);
    try {
      await projectApi.deleteProject(id);
      navigate("/dashboard");
    } catch (err) {
      showFlash(err?.response?.data?.message || "Failed to delete", "error");
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        <p className="text-sm text-gray-500 tracking-[0.25em] uppercase">
          Loading project…
        </p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-[#050508] flex flex-col items-center justify-center px-4 gap-4">
        <p className="text-pink-400 text-sm">{error || "Project not found"}</p>
        <Link
          to="/dashboard"
          className="text-xs text-gray-500 hover:text-gray-300 tracking-[0.2em] uppercase"
        >
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  const statusStyle = STATUS_STYLE[project.status] || STATUS_STYLE.planning;
  const pendingEntries =
    team?.members?.filter(
      (m) => m.status === "invited" || m.status === "requested"
    ) || [];

  return (
    <div className="min-h-screen bg-[#050508] text-white relative overflow-x-hidden">
      {/* Ambient blobs */}
      <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] bg-green-500/[0.08] rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-pink-500/[0.08] rounded-full blur-[140px] pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Top nav row */}
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/dashboard"
            className="text-xs text-gray-500 hover:text-gray-300 tracking-[0.2em] uppercase"
          >
            ← Dashboard
          </Link>

          <div className="flex items-center gap-2">
            {isOwner && (
              <>
                <button
                  onClick={() => setShowInvite(true)}
                  className="text-xs font-semibold tracking-wider uppercase text-green-300 hover:text-green-200 px-3 py-1.5 rounded-md border border-green-400/30 hover:border-green-400/50 hover:bg-green-400/5 transition-colors"
                >
                  + Invite
                </button>
                <button
                  onClick={handleDeleteProject}
                  disabled={busy}
                  className="text-xs font-semibold tracking-wider uppercase text-gray-500 hover:text-pink-400 px-3 py-1.5 rounded-md hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  Delete
                </button>
              </>
            )}
            {!isOwner && !isMember && (
              <button
                onClick={handleRequestJoin}
                disabled={busy}
                className="text-xs font-semibold tracking-wider uppercase text-pink-300 hover:text-pink-200 px-3 py-1.5 rounded-md border border-pink-500/30 hover:border-pink-500/50 hover:bg-pink-500/5 transition-colors disabled:opacity-50"
              >
                Request to Join
              </button>
            )}
          </div>
        </div>

        {/* Header block */}
        <div className="mb-6">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-medium tracking-[0.2em] uppercase mb-3 ${statusStyle.label}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
            {project.status.replace("-", " ")}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
            {project.title}
          </h1>
          {project.description && (
            <p className="text-sm text-gray-400 max-w-2xl leading-relaxed">
              {project.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-xs text-gray-500">
            <span>
              Owner:{" "}
              <span className="text-gray-300">{project.owner?.name}</span>
            </span>
            {project.timeline && (
              <>
                <span className="text-gray-700">·</span>
                <span>
                  Timeline:{" "}
                  <span className="text-gray-300">{project.timeline}</span>
                </span>
              </>
            )}
            {project.techStack?.length > 0 && (
              <>
                <span className="text-gray-700">·</span>
                <div className="flex flex-wrap gap-1.5">
                  {project.techStack.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded border border-white/10 bg-white/[0.03] text-[10px] tracking-wider uppercase text-gray-300"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-white/[0.06] mb-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={
                "px-4 py-2.5 text-xs font-semibold tracking-[0.2em] uppercase transition-colors relative " +
                (tab === t.id
                  ? "text-white"
                  : "text-gray-500 hover:text-gray-300")
              }
            >
              {t.label}
              {tab === t.id && (
                <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-gradient-to-r from-green-400 to-pink-500" />
              )}
            </button>
          ))}
        </div>

        {/* Flash toast */}
        {flash && (
          <div
            className={
              "mb-4 text-xs px-3 py-2 rounded-lg border " +
              (flash.type === "error"
                ? "text-pink-400 bg-pink-500/10 border-pink-500/20"
                : "text-green-300 bg-green-500/10 border-green-500/20")
            }
          >
            {flash.msg}
          </div>
        )}

        {/* Tab content */}
        {tab === "overview" && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="bg-[#0a0a12]/40 backdrop-blur-md border border-white/[0.08] rounded-xl p-5">
              <h3 className="text-[10px] font-bold tracking-[0.25em] uppercase text-green-300 mb-3">
                About
              </h3>
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
                {project.description || (
                  <span className="text-gray-600 italic">
                    No description yet.
                  </span>
                )}
              </p>
            </div>

            <div className="bg-[#0a0a12]/40 backdrop-blur-md border border-white/[0.08] rounded-xl p-5">
              <h3 className="text-[10px] font-bold tracking-[0.25em] uppercase text-pink-300 mb-3">
                Stats
              </h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-2xl font-bold text-white">
                    {tasks.filter((t) => t.status === "todo").length}
                  </div>
                  <div className="text-[10px] text-green-300 tracking-wider uppercase mt-1">
                    To Do
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">
                    {tasks.filter((t) => t.status === "in-progress").length}
                  </div>
                  <div className="text-[10px] text-amber-300 tracking-wider uppercase mt-1">
                    Doing
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">
                    {tasks.filter((t) => t.status === "done").length}
                  </div>
                  <div className="text-[10px] text-pink-300 tracking-wider uppercase mt-1">
                    Done
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "team" && (
          <div className="space-y-4">
            {/* Owner + accepted members */}
            <div className="bg-[#0a0a12]/40 backdrop-blur-md border border-white/[0.08] rounded-xl p-5">
              <h3 className="text-[10px] font-bold tracking-[0.25em] uppercase text-green-300 mb-4">
                Members
              </h3>
              <ul className="space-y-2">
                <li className="flex items-center gap-3 py-2">
                  <span className="w-9 h-9 rounded-full bg-gradient-to-br from-green-500/40 to-pink-500/40 border border-white/10 flex items-center justify-center text-sm font-bold">
                    {project.owner?.name?.charAt(0)?.toUpperCase() || "?"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white">
                      {project.owner?.name}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {project.owner?.email}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-amber-300">
                    Owner
                  </span>
                </li>
                {project.members?.map((m) => (
                  <li key={m._id} className="flex items-center gap-3 py-2">
                    <span className="w-9 h-9 rounded-full bg-gradient-to-br from-green-500/30 to-pink-500/30 border border-white/10 flex items-center justify-center text-sm font-bold">
                      {m.name?.charAt(0)?.toUpperCase() || "?"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white">{m.name}</div>
                      <div className="text-[11px] text-gray-500">{m.email}</div>
                    </div>
                    {isOwner && (
                      <button
                        onClick={() => handleRemoveMember(m._id)}
                        disabled={busy}
                        className="text-[10px] font-semibold tracking-wider uppercase text-gray-500 hover:text-pink-400 px-2 py-1 rounded hover:bg-white/5"
                      >
                        Remove
                      </button>
                    )}
                  </li>
                ))}
                {(!project.members || project.members.length === 0) && (
                  <li className="text-xs text-gray-600 italic py-2">
                    No additional members yet.
                  </li>
                )}
              </ul>
            </div>

            {/* Pending invites + requests (owner only + own invites) */}
            {(isOwner || isMember) && pendingEntries.length > 0 && (
              <div className="bg-[#0a0a12]/40 backdrop-blur-md border border-white/[0.08] rounded-xl p-5">
                <h3 className="text-[10px] font-bold tracking-[0.25em] uppercase text-pink-300 mb-4">
                  Pending
                </h3>
                <ul className="space-y-2">
                  {pendingEntries.map((entry) => {
                    const u = entry.user;
                    const isMineInvite =
                      entry.status === "invited" &&
                      String(u?._id) === String(currentUserId);
                    const canRespondAsOwner =
                      entry.status === "requested" && isOwner;
                    const canRespond = isMineInvite || canRespondAsOwner;
                    return (
                      <li
                        key={String(u?._id)}
                        className="flex items-center gap-3 py-2"
                      >
                        <span className="w-9 h-9 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center text-sm font-bold">
                          {u?.name?.charAt(0)?.toUpperCase() || "?"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white">
                            {u?.name || "Unknown"}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            {entry.status === "invited"
                              ? "Invited"
                              : "Requested to join"}
                          </div>
                        </div>
                        {canRespond && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() =>
                                respondTo(u._id, "accepted")
                              }
                              disabled={busy}
                              className="text-[10px] font-semibold tracking-wider uppercase text-green-300 hover:text-green-200 px-2.5 py-1 rounded-md border border-green-400/30 hover:border-green-400/50 hover:bg-green-400/5"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() =>
                                respondTo(u._id, "rejected")
                              }
                              disabled={busy}
                              className="text-[10px] font-semibold tracking-wider uppercase text-gray-500 hover:text-pink-400 px-2.5 py-1 rounded-md hover:bg-white/5"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        {tab === "tasks" && (
          <div>
            {!isOwner && !isMember ? (
              <div className="bg-[#0a0a12]/40 backdrop-blur-md border border-white/[0.08] rounded-xl p-8 text-center">
                <p className="text-sm text-gray-500">
                  Join this project to see and manage its tasks.
                </p>
              </div>
            ) : (
              <KanbanBoard
                tasks={tasks}
                members={project.members || []}
                currentUserId={currentUserId}
                ownerId={ownerId}
                onMoveTask={moveTask}
                onCreateTask={createTask}
                onUpdateTask={updateTask}
                onDeleteTask={deleteTask}
              />
            )}
          </div>
        )}
      </div>

      {showInvite && (
        <InviteMemberDialog
          projectId={id}
          currentUserId={currentUserId}
          members={project.members || []}
          teamEntries={team?.members || []}
          onClose={() => setShowInvite(false)}
          onInvited={() => {
            loadTeam();
            showFlash("Invite sent", "info");
          }}
        />
      )}
    </div>
  );
}
