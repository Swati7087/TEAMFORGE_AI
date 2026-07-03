import { Link, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProject } from "../hooks/useProjects";
import { useTasks } from "../hooks/useTasks";
import KanbanBoard from "../components/task/KanbanBoard";
import AIBreakdownButton from "../components/ai/AIBreakdownButton";

// Focused full-screen Kanban view. Same board as the /projects/:id "Tasks"
// tab, just chrome-lite so it doesn't compete with the cards visually.
export default function TaskBoard() {
  const { id } = useParams();
  const { user } = useAuth();
  const { project, loading, error } = useProject(id);
  const {
    tasks,
    loading: tasksLoading,
    moveTask,
    createTask,
    updateTask,
    deleteTask,
  } = useTasks(id);

  const currentUserId = user?._id || user?.id;
  const ownerId = project?.owner?._id || project?.owner;
  const isOwner =
    currentUserId && ownerId && String(currentUserId) === String(ownerId);
  const isMember = project?.members?.some(
    (m) => String(m._id || m) === String(currentUserId)
  );
  const canBreakdown = Boolean(isOwner || isMember);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        <p className="text-sm text-gray-500 tracking-[0.25em] uppercase">
          Loading…
        </p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-[#050508] flex flex-col items-center justify-center gap-4">
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

  return (
    <div className="min-h-screen bg-[#050508] text-white relative overflow-x-hidden">
      <div className="absolute top-[-10%] left-[-5%] w-[400px] h-[400px] bg-green-500/[0.06] rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] bg-pink-500/[0.06] rounded-full blur-[140px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <Link
            to={`/projects/${id}`}
            className="text-xs text-gray-500 hover:text-gray-300 tracking-[0.2em] uppercase"
          >
            ← {project.title}
          </Link>
          <span className="text-[10px] text-gray-600 tracking-[0.25em] uppercase">
            {tasks.length} task{tasks.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <h1 className="text-2xl font-bold">
            <span className="text-gray-500 font-normal">Board · </span>
            {project.title}
          </h1>

          {canBreakdown && (
            <AIBreakdownButton projectId={id} onCreateTask={createTask} />
          )}
        </div>

        {!isOwner && !isMember ? (
          <div className="bg-[#0a0a12]/40 backdrop-blur-md border border-white/[0.08] rounded-xl p-8 text-center">
            <p className="text-sm text-gray-500">
              Join this project to view its tasks.
            </p>
          </div>
        ) : tasksLoading ? (
          <p className="text-sm text-gray-500 tracking-wider uppercase text-center py-8">
            Loading tasks…
          </p>
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
    </div>
  );
}
