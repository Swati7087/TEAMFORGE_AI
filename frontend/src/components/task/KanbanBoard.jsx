import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import KanbanColumn from "./KanbanColumn";
import { TaskCardBody } from "./TaskCard";
import TaskDialog from "./TaskDialog";

const COLUMNS = ["todo", "in-progress", "done"];

/**
 * Kanban board — 3 columns (todo / in-progress / done). Drag a card between
 * columns to update its status. The parent supplies `tasks`, `members` and
 * the mutation callbacks so this component stays lean and reusable.
 */
export default function KanbanBoard({
  tasks,
  members,
  currentUserId,
  ownerId,
  onMoveTask,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
}) {
  const [activeTask, setActiveTask] = useState(null); // being dragged
  const [dialogTask, setDialogTask] = useState(null); // being viewed/edited
  const [creatingIn, setCreatingIn] = useState(null); // status to seed the create dialog

  // Only accept a drag once the pointer has moved 8px — protects the "click
  // to open" gesture from being consumed by a phantom drag.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const tasksByColumn = useMemo(() => {
    const groups = { todo: [], "in-progress": [], done: [] };
    for (const t of tasks) {
      if (groups[t.status]) groups[t.status].push(t);
    }
    return groups;
  }, [tasks]);

  const findTask = (id) => tasks.find((t) => t._id === id);

  const handleDragStart = (event) => {
    const task = findTask(event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const task = findTask(active.id);
    if (!task) return;

    // The drop target is either a column (id in COLUMNS) or another card.
    // If it's a card, resolve its column via its status.
    let targetColumn = null;
    if (COLUMNS.includes(over.id)) {
      targetColumn = over.id;
    } else {
      const overTask = findTask(over.id);
      if (overTask) targetColumn = overTask.status;
    }

    if (!targetColumn || targetColumn === task.status) return;
    onMoveTask?.(task._id, targetColumn);
  };

  const handleAddTask = (columnStatus) => setCreatingIn(columnStatus);
  const handleOpenTask = (task) => setDialogTask(task);

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveTask(null)}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col}
              id={col}
              tasks={tasksByColumn[col]}
              onOpenTask={handleOpenTask}
              onAddTask={handleAddTask}
            />
          ))}
        </div>

        {/* Dragged card floats above with a hot-pink glow so it's obvious what
            is currently being moved. Uses the pure body (no sortable) to
            avoid registering a duplicate id in the dnd-kit context. */}
        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <div className="rotate-1 scale-[1.04] shadow-[0_0_40px_rgba(236,72,153,0.35)] ring-1 ring-pink-500/40 rounded-lg cursor-grabbing">
              <TaskCardBody task={activeTask} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Create-task dialog (opens from a column's + button). */}
      {creatingIn && (
        <TaskDialog
          mode="create"
          initialStatus={creatingIn}
          members={members}
          currentUserId={currentUserId}
          onClose={() => setCreatingIn(null)}
          onSubmit={async (payload) => {
            await onCreateTask?.(payload);
            setCreatingIn(null);
          }}
        />
      )}

      {/* View / edit dialog for an existing task. */}
      {dialogTask && (
        <TaskDialog
          mode="edit"
          task={dialogTask}
          members={members}
          currentUserId={currentUserId}
          ownerId={ownerId}
          onClose={() => setDialogTask(null)}
          onSubmit={async (payload) => {
            await onUpdateTask?.(dialogTask._id, payload);
            setDialogTask(null);
          }}
          onDelete={async () => {
            await onDeleteTask?.(dialogTask._id);
            setDialogTask(null);
          }}
        />
      )}
    </>
  );
}
