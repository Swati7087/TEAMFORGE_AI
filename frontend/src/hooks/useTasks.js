import { useCallback, useEffect, useState } from "react";
import * as taskApi from "../api/task.api";

/**
 * Fetch + manage the task list for a single project.
 *
 * The Kanban board leans heavily on `moveTask` — it applies the new status
 * to local state immediately (so the card snaps to its new column on drop)
 * and calls the backend in the background. On failure we roll back to the
 * previous status so a network hiccup doesn't leave stale UI.
 */
export function useTasks(projectId) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await taskApi.getTasksByProject(projectId);
      setTasks(data || []);
    } catch (err) {
      setError(
        err?.response?.data?.message || err.message || "Failed to load tasks"
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  // Optimistic status update. Returns the (soft) success/failure so callers
  // can surface a toast if we roll back.
  const moveTask = useCallback(async (taskId, newStatus) => {
    let previous = null;
    setTasks((current) => {
      const next = current.map((t) => {
        if (t._id === taskId) {
          previous = t.status;
          return { ...t, status: newStatus };
        }
        return t;
      });
      return next;
    });

    try {
      await taskApi.updateTaskStatus(taskId, newStatus);
      return { ok: true };
    } catch (err) {
      // Roll back to whatever the status was before the drop.
      setTasks((current) =>
        current.map((t) =>
          t._id === taskId ? { ...t, status: previous ?? t.status } : t
        )
      );
      return {
        ok: false,
        error:
          err?.response?.data?.message ||
          err.message ||
          "Failed to update task status",
      };
    }
  }, []);

  const createTask = useCallback(async (payload) => {
    const created = await taskApi.createTask({ ...payload, project: projectId });
    setTasks((current) => [created, ...current]);
    return created;
  }, [projectId]);

  const updateTask = useCallback(async (taskId, payload) => {
    const updated = await taskApi.updateTask(taskId, payload);
    setTasks((current) =>
      current.map((t) => (t._id === taskId ? { ...t, ...updated } : t))
    );
    return updated;
  }, []);

  const deleteTask = useCallback(async (taskId) => {
    await taskApi.deleteTask(taskId);
    setTasks((current) => current.filter((t) => t._id !== taskId));
  }, []);

  return {
    tasks,
    loading,
    error,
    refetch: load,
    moveTask,
    createTask,
    updateTask,
    deleteTask,
  };
}
