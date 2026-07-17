import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useAuth } from "../hooks/useAuth";
import { useProjects } from "../hooks/useProjects";
import * as dashboardApi from "../api/dashboard.api";

// Terminal Punk palette used consistently across all charts. Matches the
// Kanban column colors so someone glancing at the donut instantly maps back
// to the board.
const COLOR_TODO = "#4ade80"; // neon green
const COLOR_INPROGRESS = "#fbbf24"; // amber
const COLOR_DONE = "#ec4899"; // hot pink

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
  const { projects, loading: projectsLoading, error: projectsError } =
    useProjects();

  const [summary, setSummary] = useState(null);
  const [productivity, setProductivity] = useState([]);
  const [dashLoading, setDashLoading] = useState(true);
  const [dashError, setDashError] = useState(null);

  const currentUserId = user?._id || user?.id;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setDashLoading(true);
      setDashError(null);
      try {
        const [s, p] = await Promise.all([
          dashboardApi.getDashboardSummary(),
          dashboardApi.getProductivity(),
        ]);
        if (!cancelled) {
          setSummary(s);
          setProductivity(p || []);
        }
      } catch (err) {
        if (!cancelled) {
          setDashError(
            err?.response?.data?.message ||
              err.message ||
              "Failed to load dashboard"
          );
        }
      } finally {
        if (!cancelled) setDashLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#050508] relative overflow-hidden">
      <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-green-500/[0.08] rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-30%] right-[-10%] w-[600px] h-[600px] bg-pink-500/[0.08] rounded-full blur-[160px] pointer-events-none" />

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
            <Link
              to="/profile"
              title="Your profile"
              aria-label="Go to your profile"
              className="w-9 h-9 rounded-full bg-gradient-to-br from-green-500/40 to-pink-500/40 border border-white/10 flex items-center justify-center text-sm font-bold text-white hover:shadow-[0_0_20px_rgba(236,72,153,0.35)] hover:border-pink-400/40 transition-all shrink-0 overflow-hidden"
            >
              {user?.profilePicture ? (
                <img
                  src={user.profilePicture}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                user?.name?.charAt(0)?.toUpperCase() || "?"
              )}
            </Link>
            <button
              onClick={logout}
              className="text-xs font-medium text-gray-300 hover:text-white border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] rounded-lg px-3 py-1.5 transition-all duration-200"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="relative max-w-6xl mx-auto px-6 py-12">
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
              Your projects, tasks, deadlines, and AI insights all live here.
            </p>
          </div>

          <Link
            to="/projects/new"
            className="inline-flex items-center gap-2 text-sm font-semibold text-white px-5 py-2.5 rounded-lg bg-gradient-to-r from-green-500 to-pink-500 hover:shadow-[0_0_30px_rgba(74,222,128,0.4)] transition-all whitespace-nowrap"
          >
            + New project
          </Link>
        </div>

        {/* Stats row — driven by the /summary aggregate endpoint */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Active projects"
            value={summary?.activeProjects ?? "—"}
            hint={
              summary?.completedProjects
                ? `+${summary.completedProjects} completed`
                : "Planning or in-progress"
            }
            accent="green"
            loading={dashLoading}
          />
          <StatCard
            label="Completed tasks"
            value={summary?.completedTasks ?? "—"}
            hint={
              summary?.totalTasks
                ? `${summary.completedTasks} of ${summary.totalTasks} total`
                : "None yet"
            }
            accent="pink"
            loading={dashLoading}
          />
          <StatCard
            label="Pending tasks"
            value={summary?.pendingTasks ?? "—"}
            hint="To do + in progress"
            accent="amber"
            loading={dashLoading}
          />
          <StatCard
            label="Due this week"
            value={summary?.upcomingDeadlines?.length ?? "—"}
            hint="Within 7 days"
            accent="pink"
            loading={dashLoading}
          />
        </div>

        {dashError && (
          <div className="mb-6 text-xs text-pink-400 bg-pink-500/10 border border-pink-500/20 rounded-lg px-4 py-3">
            {dashError}
          </div>
        )}

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          <ChartCard title="Task breakdown" accent="green">
            <TasksByStatusDonut
              data={summary?.tasksByStatus}
              loading={dashLoading}
            />
          </ChartCard>
          <ChartCard title="Last 7 days" accent="pink">
            <ProductivityLine data={productivity} loading={dashLoading} />
          </ChartCard>
        </div>

        {/* Upcoming deadlines */}
        <div className="mb-8">
          <h2 className="text-xs font-bold text-gray-300 tracking-[0.25em] uppercase mb-4">
            Upcoming deadlines
          </h2>
          <UpcomingDeadlines
            items={summary?.upcomingDeadlines || []}
            loading={dashLoading}
          />
        </div>

        {/* Projects grid */}
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

          {projectsLoading ? (
            <p className="text-sm text-gray-500 tracking-wider uppercase py-8 text-center">
              Loading projects…
            </p>
          ) : projectsError ? (
            <div className="text-xs text-pink-400 bg-pink-500/10 border border-pink-500/20 rounded-lg px-4 py-3">
              {projectsError}
            </div>
          ) : projects.length === 0 ? (
            <div className="bg-[#0a0a12]/40 backdrop-blur-md border border-dashed border-white/[0.12] rounded-2xl p-10 text-center">
              <p className="text-sm text-gray-400 mb-1">No projects yet</p>
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

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

function StatCard({ label, value, hint, accent, loading }) {
  const accentMap = {
    green: {
      gradient: "from-green-500/20 to-transparent",
      text: "text-green-300",
    },
    pink: {
      gradient: "from-pink-500/20 to-transparent",
      text: "text-pink-300",
    },
    amber: {
      gradient: "from-amber-500/20 to-transparent",
      text: "text-amber-300",
    },
  };
  const { gradient, text } = accentMap[accent];
  return (
    <div className="relative group">
      <div
        className={`absolute -inset-px rounded-2xl bg-gradient-to-br ${gradient} opacity-40 blur-sm transition-opacity duration-300 group-hover:opacity-70`}
      />
      <div className="relative bg-[#0a0a12]/70 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
        <p className="text-[10px] font-medium text-gray-400 tracking-[0.2em] uppercase mb-2">
          {label}
        </p>
        <p className={`text-3xl font-bold ${text}`}>
          {loading ? <span className="text-gray-700">—</span> : value}
        </p>
        <p className="text-[10px] text-gray-500 mt-1.5 tracking-wider uppercase">
          {hint}
        </p>
      </div>
    </div>
  );
}

function ChartCard({ title, accent, children }) {
  const border =
    accent === "green" ? "border-green-400/20" : "border-pink-400/20";
  const text =
    accent === "green" ? "text-green-300" : "text-pink-300";
  return (
    <div
      className={`relative bg-[#0a0a12]/60 backdrop-blur-md border ${border} rounded-2xl p-5`}
    >
      <p
        className={`text-[10px] font-bold tracking-[0.25em] uppercase ${text} mb-3`}
      >
        {title}
      </p>
      <div className="h-56">{children}</div>
    </div>
  );
}

function TasksByStatusDonut({ data, loading }) {
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-gray-500 tracking-wider uppercase">
        Loading…
      </div>
    );
  }
  const buckets = data || { todo: 0, "in-progress": 0, done: 0 };
  const total = buckets.todo + buckets["in-progress"] + buckets.done;
  const pieData = [
    { name: "To do", value: buckets.todo, color: COLOR_TODO },
    { name: "In progress", value: buckets["in-progress"], color: COLOR_INPROGRESS },
    { name: "Done", value: buckets.done, color: COLOR_DONE },
  ];

  if (total === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-1">
        <p className="text-sm text-gray-500">No tasks yet</p>
        <p className="text-[10px] text-gray-600 tracking-wider uppercase">
          Create one to see the breakdown
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={pieData}
            innerRadius={54}
            outerRadius={82}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
          >
            {pieData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "rgba(10, 10, 18, 0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              fontSize: 12,
              color: "#fff",
            }}
            itemStyle={{ color: "#fff" }}
            formatter={(v, n) => [`${v} task${v === 1 ? "" : "s"}`, n]}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Center total */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-bold text-white">{total}</div>
        <div className="text-[9px] text-gray-500 tracking-[0.2em] uppercase mt-0.5">
          Total
        </div>
      </div>
      {/* Legend */}
      <div className="mt-2 flex items-center justify-center gap-3 text-[10px] tracking-wider uppercase">
        <LegendDot color={COLOR_TODO} label={`To do ${buckets.todo}`} />
        <LegendDot
          color={COLOR_INPROGRESS}
          label={`Doing ${buckets["in-progress"]}`}
        />
        <LegendDot color={COLOR_DONE} label={`Done ${buckets.done}`} />
      </div>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-gray-400">
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ background: color, boxShadow: `0 0 6px ${color}80` }}
      />
      {label}
    </span>
  );
}

function ProductivityLine({ data, loading }) {
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-gray-500 tracking-wider uppercase">
        Loading…
      </div>
    );
  }
  const chartData = (data || []).map((d) => ({
    ...d,
    // "07-01" style label on the x-axis
    label: d.date.slice(5),
  }));
  const total = chartData.reduce((n, d) => n + d.tasksCompleted, 0);

  if (total === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-1">
        <p className="text-sm text-gray-500">No tasks completed in the last 7 days</p>
        <p className="text-[10px] text-gray-600 tracking-wider uppercase">
          Ship one — the chart will light up
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={chartData}
        margin={{ top: 8, right: 12, left: -20, bottom: 0 }}
      >
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={COLOR_TODO} />
            <stop offset="100%" stopColor={COLOR_DONE} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "#6b7280", fontSize: 10 }}
          axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "#6b7280", fontSize: 10 }}
          axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
          tickLine={false}
          width={30}
        />
        <Tooltip
          contentStyle={{
            background: "rgba(10, 10, 18, 0.95)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            fontSize: 12,
            color: "#fff",
          }}
          itemStyle={{ color: "#fff" }}
          labelFormatter={(l) => `Date: ${l}`}
          formatter={(v) => [`${v} completed`, "Tasks"]}
        />
        <Line
          type="monotone"
          dataKey="tasksCompleted"
          stroke="url(#lineGrad)"
          strokeWidth={2.5}
          dot={{ r: 3, fill: COLOR_DONE, stroke: "none" }}
          activeDot={{ r: 5, fill: COLOR_DONE, stroke: "#fff", strokeWidth: 1 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function UpcomingDeadlines({ items, loading }) {
  if (loading) {
    return (
      <div className="bg-[#0a0a12]/40 backdrop-blur-md border border-white/[0.08] rounded-xl p-6 text-center text-sm text-gray-500 tracking-wider uppercase">
        Loading…
      </div>
    );
  }
  if (!items || items.length === 0) {
    return (
      <div className="bg-[#0a0a12]/40 backdrop-blur-md border border-white/[0.08] rounded-xl p-6 text-center">
        <p className="text-sm text-gray-500">No tasks due in the next 7 days.</p>
        <p className="text-[10px] text-gray-600 tracking-wider uppercase mt-1">
          Nice, or add deadlines to see them here
        </p>
      </div>
    );
  }
  return (
    <ul className="bg-[#0a0a12]/40 backdrop-blur-md border border-white/[0.08] rounded-xl overflow-hidden divide-y divide-white/[0.05]">
      {items.map((t) => (
        <DeadlineRow key={String(t.taskId)} item={t} />
      ))}
    </ul>
  );
}

function DeadlineRow({ item }) {
  const priorityStyle = {
    high: "text-pink-300 border-pink-500/30 bg-pink-500/5",
    medium: "text-amber-300 border-amber-400/30 bg-amber-400/5",
    low: "text-gray-400 border-white/10 bg-white/[0.03]",
  };
  const { relative, tone } = formatDeadline(item.deadline);
  return (
    <li className="px-4 py-3 flex items-center gap-3 hover:bg-white/[0.03] transition-colors">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white truncate">{item.title}</div>
        <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-2">
          <Link
            to={`/projects/${item.projectId}`}
            className="hover:text-green-300 truncate"
          >
            {item.projectTitle}
          </Link>
        </div>
      </div>
      {item.priority && (
        <span
          className={`hidden sm:inline text-[9px] tracking-[0.2em] uppercase px-2 py-0.5 rounded border ${
            priorityStyle[item.priority] || priorityStyle.medium
          }`}
        >
          {item.priority}
        </span>
      )}
      <span
        className={`text-[10px] tracking-wider uppercase whitespace-nowrap ${
          tone === "urgent"
            ? "text-pink-300"
            : tone === "soon"
            ? "text-amber-300"
            : "text-gray-400"
        }`}
      >
        {relative}
      </span>
    </li>
  );
}

function formatDeadline(iso) {
  if (!iso) return { relative: "no due date", tone: "cool" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { relative: "no due date", tone: "cool" };
  }
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays < 0) {
    return { relative: `${-diffDays}d overdue`, tone: "urgent" };
  }
  if (diffDays === 0) return { relative: "due today", tone: "urgent" };
  if (diffDays === 1) return { relative: "due tomorrow", tone: "urgent" };
  if (diffDays <= 3) return { relative: `in ${diffDays}d`, tone: "soon" };
  return { relative: `in ${diffDays}d`, tone: "cool" };
}

function ProjectCard({ project, currentUserId }) {
  const ownerId = project.owner?._id || project.owner;
  const isOwner = String(ownerId) === String(currentUserId);
  const memberCount = (project.members?.length || 0) + 1;
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
