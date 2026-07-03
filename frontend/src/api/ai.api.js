import axiosClient from "./axiosClient";

// Wrappers around /api/ai. Same envelope-peeling convention as the rest of
// the API layer — return the inner `data` on success.
//
// Failure handling: we intentionally DO NOT swallow errors here. The backend
// returns a clean 502 with { success:false, message:"AI generation failed,
// please try again" } on Gemini/parse failures. Callers should catch and use
// err.response.data.message (fall back to err.message) so the UI can surface
// the real reason inline / via toast.

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
