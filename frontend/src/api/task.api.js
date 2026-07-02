import axiosClient from "./axiosClient";

// Wrappers around /api/tasks. Same envelope-peeling convention as
// project.api.js and auth.api.js.

export async function createTask(payload) {
  const res = await axiosClient.post("/api/tasks", payload);
  return res.data.data;
}

export async function getTasksByProject(projectId) {
  const res = await axiosClient.get(`/api/tasks/project/${projectId}`);
  return res.data.data;
}

export async function updateTask(id, payload) {
  const res = await axiosClient.put(`/api/tasks/${id}`, payload);
  return res.data.data;
}

export async function deleteTask(id) {
  const res = await axiosClient.delete(`/api/tasks/${id}`);
  return res.data.data;
}

export async function updateTaskStatus(id, status) {
  const res = await axiosClient.patch(`/api/tasks/${id}/status`, { status });
  return res.data.data;
}
