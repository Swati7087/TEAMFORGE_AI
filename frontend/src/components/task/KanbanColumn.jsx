import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import TaskCard from "./TaskCard";

// Terminal Punk palette per column — green = todo, amber = in-progress, pink = done.
const COLUMN_STYLES = {
  todo: {
    dot: "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]",
    label: "text-green-300",
    ring: "hover:border-green-400/30",
    dropRing: "border-green-400/50 shadow-[0_0_30px_rgba(74,222,128,0.15)]",
    title: "To Do",
  },
  "in-progress": {
    dot: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]",
    label: "text-amber-300",
    ring: "hover:border-amber-400/30",
    dropRing: "border-amber-400/50 shadow-[0_0_30px_rgba(251,191,36,0.15)]",
    title: "In Progress",
  },
  done: {
    dot: "bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.8)]",
    label: "text-pink-300",
    ring: "hover:border-pink-500/30",
    dropRing: "border-pink-500/50 shadow-[0_0_30px_rgba(236,72,153,0.15)]",
    title: "Done",
  },
};

export default function KanbanColumn({ id, tasks, onOpenTask, onAddTask }) {
  const style = COLUMN_STYLES[id] || COLUMN_STYLES.todo;

  // Droppable target for the whole column — matters when the column is empty
  // (no sortable items to hit) so users can still drop onto it.
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={
        "relative flex flex-col bg-[#0a0a12]/40 backdrop-blur-md " +
        "border rounded-xl p-4 transition-all duration-200 " +
        (isOver
          ? style.dropRing
          : "border-white/[0.08] " + style.ring)
      }
    >
      {/* Column header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${style.dot}`} />
          <h3 className={`text-xs font-bold tracking-[0.25em] uppercase ${style.label}`}>
            {style.title}
          </h3>
          <span className="text-[10px] text-gray-600 font-mono">
            {tasks.length}
          </span>
        </div>

        <button
          onClick={() => onAddTask?.(id)}
          className="text-gray-500 hover:text-white text-lg leading-none w-6 h-6 rounded flex items-center justify-center hover:bg-white/5 transition-colors"
          aria-label="Add task"
        >
          +
        </button>
      </div>

      {/* Task list */}
      <SortableContext
        id={id}
        items={tasks.map((t) => t._id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2 min-h-[100px]">
          {tasks.length === 0 ? (
            <div className="text-xs text-gray-600 text-center py-8 italic">
              No tasks yet
            </div>
          ) : (
            tasks.map((task) => (
              <TaskCard key={task._id} task={task} onOpen={onOpenTask} />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}
