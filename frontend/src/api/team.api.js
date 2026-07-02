import axiosClient from "./axiosClient";

// Wrappers around /api/teams. Team endpoints are all keyed by projectId in
// the URL; the backend does the auth checks (owner-only invite, etc.).

export async function inviteToTeam(projectId, { userId, role } = {}) {
  const res = await axiosClient.post(`/api/teams/${projectId}/invite`, {
    userId,
    role,
  });
  return res.data.data;
}

export async function requestToJoin(projectId) {
  const res = await axiosClient.post(`/api/teams/${projectId}/request`);
  return res.data.data;
}

export async function respondToInvite(projectId, { userId, status }) {
  const res = await axiosClient.patch(`/api/teams/${projectId}/respond`, {
    userId,
    status,
  });
  return res.data.data;
}

export async function getTeamForProject(projectId) {
  const res = await axiosClient.get(`/api/teams/${projectId}`);
  return res.data.data;
}

export async function removeMember(projectId, userId) {
  const res = await axiosClient.delete(
    `/api/teams/${projectId}/members/${userId}`
  );
  return res.data.data;
}
