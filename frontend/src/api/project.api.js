import axiosClient from "./axiosClient";

// Wrappers around /api/projects. Each returns the inner `data` from the
// backend's { success, message, data } envelope.

export async function createProject(payload) {
  const res = await axiosClient.post("/api/projects", payload);
  return res.data.data;
}

export async function getProjects() {
  const res = await axiosClient.get("/api/projects");
  return res.data.data;
}

export async function getProjectById(id) {
  const res = await axiosClient.get(`/api/projects/${id}`);
  return res.data.data;
}

export async function updateProject(id, payload) {
  const res = await axiosClient.put(`/api/projects/${id}`, payload);
  return res.data.data;
}

export async function deleteProject(id) {
  const res = await axiosClient.delete(`/api/projects/${id}`);
  return res.data.data;
}
