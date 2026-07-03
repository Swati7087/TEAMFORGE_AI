import axiosClient from "./axiosClient";

// Wrappers around /api/dashboard. Same envelope-peeling convention as the
// rest of the API layer — return the inner `data` on success.

export async function getDashboardSummary() {
  const res = await axiosClient.get("/api/dashboard/summary");
  return res.data.data;
}

export async function getProductivity() {
  const res = await axiosClient.get("/api/dashboard/productivity");
  return res.data.data;
}
