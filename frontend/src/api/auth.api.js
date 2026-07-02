import axiosClient from "./axiosClient";

// Each wrapper returns the inner `data` payload from the backend's
// { success, message, data } envelope so callers don't have to peel it apart.

export async function signup({ name, email, password }) {
  const res = await axiosClient.post("/api/auth/signup", { name, email, password });
  return res.data.data; // { token, user }
}

export async function login({ email, password }) {
  const res = await axiosClient.post("/api/auth/login", { email, password });
  return res.data.data; // { token, user }
}

export async function getMe() {
  const res = await axiosClient.get("/api/auth/me");
  return res.data.data; // { user }
}
