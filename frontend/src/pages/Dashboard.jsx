import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProjects } from "../hooks/useProjects";

const STATUS_STYLE = {
  planning: {
    dot: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]",
    label: "text-amber-300",
  },
  "in-progress": {
    dot: "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.7)]",
    label: "text-green-300",
  },
  completed: {
    dot: "bg-pink-500 shadow-[0_0_6px_rgba(236,72,153,0.7)]",
    label: "text-pink-300",
  },
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { projects, loading, error } = useProjects();

  const currentUserId = user?._id || user?.id;
  const ownedCount = projects.filter(
    (p) => String(p.owner?._id || p.owner) === String(currentUserId)
  ).length;
  const memberCount = projects.length - ownedCount;
  const taskCount = projects.reduce(
    (n, p) => n + (p.tasks?.length || 0),
    0
  );

  return (
    <div className="min-h-screen bg-[#050508] relative overflow-hidden">
      {/* Ambient neon */}
      <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-green-500/[0.08] rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-30%] right-[-10%] w-[600px] h-[600px] bg-pink-500/[0.08] rounded-full blur-[160px] pointer-events-none" />

      {/* Top bar */}
      <header className="relative border-b border-white/[0.06] backdrop-blur-xl bg-[#050508]/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="text-xl font-bold text-white">
            Team
            <span className="bg-gradient-to-r from-green-400 to-pink-400 bg-clip-text text-transparent">
              Forge
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] text-xs text-gray-300">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
              {user?.email}
            </div>
            <button
              onClick={logout}
              className="text-xs font-medium text-gray-300 hover:text-white border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] rounded-lg px-3 py-1.5 transition-all duration-200"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="relative max-w-6xl mx-auto px-6 py-12">
        {/* Welcome */}
        <div className="mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-green-400 tracking-[0.2em] uppercase mb-2">
              Dashboard
            </p>
            <h1 className="text-4xl font-bold text-white">
              Welcome back,{" "}
              <span className="bg-gradient-to-r from-green-300 to-pink-300 bg-clip-text text-transparent">
                {user?.name}
              </span>
            </h1>
            <p className="text-gray-400 mt-2">
              Your projects, teams, and AI insights all live here.
            </p>
          </div>

          <Link
            to="/projects/new"
            className="inline-flex items-center gap-2 text-sm font-semibold text-white px-5 py-2.5 rounded-lg bg-gradient-to-r from-green-500 to-pink-500 hover:shadow-[0_0_30px_rgba(74,222,128,0.4)] transition-all whitespace-nowrap"
          >
            + New project
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <StatCard
            label="Projects owned"
            value={ownedCount}
            hint={ownedCount === 0 ? "Kick one off" : "Total active"}
            accent="green"
          />
          <StatCard
            label="Member of"
            value={memberCount}
            hint={memberCount === 0 ? "Nothing yet" : "Cross-team"}
            accent="pink"
          />
          <StatCard
            label="Total tasks"
            value={taskCount}
            hint={taskCount === 0 ? "Add your first" : "Across all projects"}
            accent="amber"
          />
        </div>

        {/* Projects list */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-gray-300 tracking-[0.25em] uppercase">
              Your projects
            </h2>
            {projects.length > 0 && (
              <span className="text-[10px] text-gray-600 tracking-[0.2em] uppercase">
                {projects.length} total
              </span>
            )}
          </div>

          {loading ? (
            <p className="text-sm text-gray-500 tracking-wider uppercase py-8 text-center">
              Loading projects…
            </p>
          ) : error ? (
            <div className="text-xs text-pink-400 bg-pink-500/10 border border-pink-500/20 rounded-lg px-4 py-3">
              {error}
            </div>
          ) : projects.length === 0 ? (
            <div className="bg-[#0a0a12]/40 backdrop-blur-md border border-dashed border-white/[0.12] rounded-2xl p-10 text-center">
              <p className="text-sm text-gray-400 mb-1">
                No projects yet
              </p>
              <p className="text-xs text-gray-600 mb-5">
                Spin up your first one to start building with your team.
              </p>
              <Link
                to="/projects/new"
                className="inline-flex items-center gap-2 text-sm font-semibold text-white px-5 py-2.5 rounded-lg bg-gradient-to-r from-green-500 to-pink-500 hover:shadow-[0_0_30px_rgba(74,222,128,0.4)] transition-all"
              >
                + Create a project
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((p) => (
                <ProjectCard
                  key={p._id}
                  project={p}
                  currentUserId={currentUserId}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, hint, accent }) {
  const accentMap = {
    green: { gradient: "from-green-500/20 to-transparent", text: "text-green-300" },
    pink: { gradient: "from-pink-500/20 to-transparent", text: "text-pink-300" },
    amber: { gradient: "from-amber-500/20 to-transparent", text: "text-amber-300" },
  };
  const { gradient, text } = accentMap[accent];
  return (
    <div className="relative group">
      <div
        className={`absolute -inset-px rounded-2xl bg-gradient-to-br ${gradient} opacity-40 blur-sm transition-opacity duration-300 group-hover:opacity-70`}
      />
      <div className="relative bg-[#0a0a12]/70 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6">
        <p className="text-xs font-medium text-gray-400 tracking-wider uppercase mb-3">
          {label}
        </p>
        <p className={`text-4xl font-bold ${text}`}>{value}</p>
        <p className="text-xs text-gray-500 mt-2">{hint}</p>
      </div>
    </div>
  );
}

function ProjectCard({ project, currentUserId }) {
  const ownerId = project.owner?._id || project.owner;
  const isOwner = String(ownerId) === String(currentUserId);
  const memberCount = (project.members?.length || 0) + 1; // owner counts as +1
  const taskCount = project.tasks?.length || 0;
  const style = STATUS_STYLE[project.status] || STATUS_STYLE.planning;

  return (
    <Link
      to={`/projects/${project._id}`}
      className="group block bg-[#0a0a12]/50 backdrop-blur-md border border-white/[0.08] hover:border-white/20 rounded-xl p-5 transition-all hover:shadow-[0_0_30px_rgba(74,222,128,0.08)]"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
          <span
            className={`text-[10px] font-bold tracking-[0.2em] uppercase ${style.label}`}
          >
            {project.status.replace("-", " ")}
          </span>
        </div>
        {isOwner && (
          <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-amber-300/70">
            Owner
          </span>
        )}
      </div>

      <h3 className="text-base font-semibold text-white mb-1 group-hover:text-green-100 transition-colors line-clamp-1">
        {project.title}
      </h3>
      {project.description ? (
        <p className="text-xs text-gray-500 line-clamp-2 mb-4 min-h-[2rem]">
          {project.description}
        </p>
      ) : (
        <p className="text-xs text-gray-700 italic mb-4 min-h-[2rem]">
          No description yet.
        </p>
      )}

      <div className="flex items-center gap-3 text-[10px] text-gray-500 tracking-wider uppercase pt-3 border-t border-white/[0.05]">
        <span>
          {memberCount} member{memberCount === 1 ? "" : "s"}
        </span>
        <span className="text-gray-700">·</span>
        <span>
          {taskCount} task{taskCount === 1 ? "" : "s"}
        </span>
      </div>
    </Link>
  );
}
