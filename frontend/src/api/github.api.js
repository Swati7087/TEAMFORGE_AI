import axiosClient from "./axiosClient";

// Wrappers around /api/github. Each returns the inner `data` from the
// backend's { success, message, data } envelope.

export async function connectRepository(projectId, repoUrl, token) {
  const res = await axiosClient.post("/api/github/connect", {
    projectId,
    repoUrl,
    token,
  });
  return res.data.data;
}

export async function getRepositoryData(projectId) {
  const res = await axiosClient.get(`/api/github/${projectId}`);
  return res.data.data;
}

export async function disconnectRepository(projectId) {
  const res = await axiosClient.delete(`/api/github/${projectId}`);
  return res.data.data;
}
