import axiosClient from "./axiosClient";

// Wrappers around /api/ai. Same envelope-peeling convention as the rest of
// the API layer — return the inner `data` on success.

export async function generateProject(idea) {
  const res = await axiosClient.post("/api/ai/generate-project", { idea });
  return res.data.data;
}

export async function generateTasks(projectId) {
  const res = await axiosClient.post("/api/ai/generate-tasks", { projectId });
  return res.data.data;
}

export async function generateProductivityReport(projectId) {
  const res = await axiosClient.post("/api/ai/productivity-report", {
    projectId,
  });
  return res.data.data;
}

export async function matchTeam(projectId) {
  const res = await axiosClient.post("/api/ai/match-team", { projectId });
  return res.data.data;
}

export async function analyzeSkillGap(projectId) {
  const res = await axiosClient.post("/api/ai/skill-gap", { projectId });
  return res.data.data;
}

export async function summarizeMeeting(projectId, rawNotes) {
  const res = await axiosClient.post("/api/ai/meeting-summary", {
    projectId,
    rawNotes,
  });
  return res.data.data;
}

export async function getMeetingHistory(projectId) {
  const res = await axiosClient.get("/api/ai/meeting-history", {
    params: { projectId },
  });
  return res.data.data;
}

export async function generateReadme(projectId) {
  const res = await axiosClient.post("/api/ai/generate-readme", { projectId });
  return res.data.data;
}

export async function detectBottlenecks(projectId) {
  const res = await axiosClient.post("/api/ai/bottleneck-detect", { projectId });
  return res.data.data;
}

export async function predictDeadline(projectId) {
  const res = await axiosClient.post("/api/ai/deadline-predict", { projectId });
  return res.data.data;
}

export async function analyzeProjectRisk(projectId) {
  const res = await axiosClient.post("/api/ai/risk-analysis", { projectId });
  return res.data.data;
}
