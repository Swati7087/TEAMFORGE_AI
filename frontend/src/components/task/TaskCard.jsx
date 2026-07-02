import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Priority → Terminal Punk palette. Full class strings so Tailwind's JIT can
// see them at build time (dynamic `bg-${priority}-500` would get purged).
const PRIORITY_STYLE = {
  low: {
    dot: "bg-gray-400 shadow-[0_0_6px_rgba(156,163,175,0.5)]",
    label: "text-gray-300",
  },
  medium: {
    dot: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]",
    label: "text-amber-300",
  },
  high: {
    dot: "bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.8)]",
    label: "text-pink-300",
  },
};

const DIFFICULTY_LABEL = { easy: "EASY", medium: "MED", hard: "HARD" };

function formatDeadline(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Pure visual card body. No drag hooks — used by both `TaskCard` (inside a
 * SortableContext) and the DragOverlay copy that follows the cursor.
 */
export function TaskCardBody({ task, className = "" }) {
  const priority = PRIORITY_STYLE[task.priority] || PRIORITY_STYLE.medium;
  const assignee = task.assignedTo;

  return (
    <div
      className={
        "bg-[#0a0a12]/60 backdrop-blur-sm border border-white/[0.08] rounded-lg p-3 " +
        "hover:border-white/20 hover:bg-[#0a0a12]/80 transition-colors " +
        className
      }
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-medium text-white leading-snug line-clamp-2">
          {task.title}
        </h4>
        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${priority.dot}`} />
      </div>

      {task.description && (
        <p className="text-xs text-gray-500 line-clamp-2 mb-3">
          {task.description}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 text-[10px] tracking-wider uppercase">
        <div className="flex items-center gap-2">
          <span className={`font-semibold ${priority.label}`}>
            {task.priority}
          </span>
          <span className="text-gray-600">·</span>
          <span className="text-gray-500">
            {DIFFICULTY_LABEL[task.difficulty] || "MED"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {task.deadline && (
            <span className="text-gray-500">{formatDeadline(task.deadline)}</span>
          )}
          {assignee && (
            <span
              title={assignee.name}
              className="w-5 h-5 rounded-full bg-gradient-to-br from-green-500/30 to-pink-500/30 border border-white/10 flex items-center justify-center text-[9px] font-bold text-white"
            >
              {assignee.name?.charAt(0)?.toUpperCase() || "?"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Draggable + clickable card living inside a SortableContext. Clicking
 * (no drag) invokes `onOpen`.
 */
export default function TaskCard({ task, onOpen }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Ghost the original while a drag is in flight — the DragOverlay renders
    // a full-strength copy on top so the user always sees something.
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (e.defaultPrevented) return;
        onOpen?.(task);
      }}
      className="group cursor-grab active:cursor-grabbing"
    >
      <TaskCardBody task={task} />
    </div>
  );
}
