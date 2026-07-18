// Pre-computed task metrics for Phase 6c health analysis features.
// Keeps Gemini prompts lean — numbers and short title lists, not raw task arrays.

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

function assigneeKey(task) {
  const id = task.assignedTo?._id || task.assignedTo;
  return id ? String(id) : null;
}

function ensureAssigneeBucket(byAssignee, key) {
  if (!byAssignee[key]) {
    byAssignee[key] = { assigned: 0, completed: 0, overdue: 0 };
  }
  return byAssignee[key];
}

export function computeTaskMetrics(tasks) {
  const now = Date.now();
  const list = Array.isArray(tasks) ? tasks : [];

  const tasksByStatus = { todo: 0, "in-progress": 0, done: 0 };
  const tasksByAssignee = {};
  let overdueTasks = 0;
  let unassignedTasks = 0;
  let completedTasks = 0;
  const completionDays = [];
  const staleInProgress = [];
  const overdueTaskTitles = [];
  const unassignedTaskTitles = [];

  for (const task of list) {
    const status = task.status || "todo";
    if (Object.prototype.hasOwnProperty.call(tasksByStatus, status)) {
      tasksByStatus[status] += 1;
    }

    if (status === "done") {
      completedTasks += 1;
      const created = new Date(task.createdAt).getTime();
      const updated = new Date(task.updatedAt).getTime();
      if (!Number.isNaN(created) && !Number.isNaN(updated)) {
        const days = (updated - created) / (1000 * 60 * 60 * 24);
        if (days >= 0) completionDays.push(days);
      }
    }

    const key = assigneeKey(task);
    if (!key) {
      if (status !== "done") {
        unassignedTasks += 1;
        unassignedTaskTitles.push(task.title);
      }
    } else {
      const bucket = ensureAssigneeBucket(tasksByAssignee, key);
      bucket.assigned += 1;
      if (status === "done") bucket.completed += 1;
    }

    if (task.deadline && status !== "done") {
      const deadline = new Date(task.deadline).getTime();
      if (!Number.isNaN(deadline) && deadline < now) {
        overdueTasks += 1;
        overdueTaskTitles.push(task.title);
        if (key) {
          ensureAssigneeBucket(tasksByAssignee, key).overdue += 1;
        }
      }
    }

    if (status === "in-progress") {
      const updated = new Date(task.updatedAt).getTime();
      if (!Number.isNaN(updated) && now - updated > FIVE_DAYS_MS) {
        staleInProgress.push({
          title: task.title,
          daysInProgress: Math.floor((now - updated) / (1000 * 60 * 60 * 24)),
        });
      }
    }
  }

  const avgCompletionDays =
    completionDays.length > 0
      ? Math.round(
          (completionDays.reduce((sum, d) => sum + d, 0) /
            completionDays.length) *
            10
        ) / 10
      : 0;

  return {
    totalTasks: list.length,
    completedTasks,
    overdueTasks,
    tasksByAssignee,
    tasksByStatus,
    avgCompletionDays,
    unassignedTasks,
    staleInProgress,
    overdueTaskTitles,
    unassignedTaskTitles,
  };
}
