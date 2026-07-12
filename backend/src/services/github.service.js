import axios from "axios";

const GITHUB_API = "https://api.github.com";

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
  };
}

async function githubGet(path, token) {
  try {
    const { data } = await axios.get(`${GITHUB_API}${path}`, {
      headers: githubHeaders(token),
      timeout: 30000,
    });
    return data;
  } catch (err) {
    const status = err.response?.status;
    const message =
      err.response?.data?.message || err.message || "GitHub API request failed";
    const error = new Error(message);
    error.status = status;
    throw error;
  }
}

export async function getCommits(owner, repo, token) {
  return githubGet(`/repos/${owner}/${repo}/commits`, token);
}

export async function getPullRequests(owner, repo, token) {
  return githubGet(`/repos/${owner}/${repo}/pulls?state=all`, token);
}

export async function getContributors(owner, repo, token) {
  return githubGet(`/repos/${owner}/${repo}/contributors`, token);
}

export async function getIssues(owner, repo, token) {
  return githubGet(`/repos/${owner}/${repo}/issues?state=all`, token);
}

export async function getBranches(owner, repo, token) {
  return githubGet(`/repos/${owner}/${repo}/branches`, token);
}

export async function getCommitDetails(owner, repo, token, sha) {
  return githubGet(`/repos/${owner}/${repo}/commits/${sha}`, token);
}
