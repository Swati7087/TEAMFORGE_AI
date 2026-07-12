import axiosClient from "./axiosClient";

export async function generateContributionAnalysis(projectId) {
  const res = await axiosClient.post("/api/ai/contribution-analysis", {
    projectId,
  });
  return res.data.data;
}

export async function getLatestContribution(projectId) {
  const res = await axiosClient.get(`/api/contributions/${projectId}`);
  return res.data.data;
}
