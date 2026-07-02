import axiosClient from "./axiosClient";

// Wrappers around /api/users. Minimal for now — the AI Team Matcher will
// grow this list later.

export async function getUsers() {
  const res = await axiosClient.get("/api/users");
  return res.data.data.users;
}

export async function getUser(id) {
  const res = await axiosClient.get(`/api/users/${id}`);
  return res.data.data.user;
}

export async function updateUser(id, payload) {
  const res = await axiosClient.put(`/api/users/${id}`, payload);
  return res.data.data.user;
}
