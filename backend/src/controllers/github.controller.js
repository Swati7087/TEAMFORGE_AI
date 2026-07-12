import Project from "../models/Project.js";
import Repository from "../models/Repository.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { success, failure } from "../utils/apiResponse.js";
import { encrypt, decrypt } from "../utils/encryption.js";
import {
  getCommits,
  getPullRequests,
  getContributors,
  getIssues,
  getBranches,
} from "../services/github.service.js";

// Parse https://github.com/owner/repo or .../owner/repo.git
export function parseGitHubRepoUrl(repoUrl) {
  if (!repoUrl || typeof repoUrl !== "string") return null;
  const trimmed = repoUrl.trim().replace(/\/$/, "");
  const match = trimmed.match(
    /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/.]+)(?:\.git)?$/i
  );
  if (!match) return null;
  return { owner: match[1], repoName: match[2] };
}

function sanitizeRepository(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  delete obj.encryptedToken;
  delete obj.tokenIv;
  return obj;
}

async function getProjectForUser(projectId, userId) {
  const project = await Project.findById(projectId);
  if (!project) return { project: null, isOwner: false, isMember: false };
  const isOwner = project.owner.equals(userId);
  const isMember = project.members.some((m) => m.equals(userId));
  return { project, isOwner, isMember };
}

function isGitHubAuthError(err) {
  const status = err?.status;
  return status === 401 || status === 403 || status === 404;
}

// POST /api/github/connect
export const connectRepository = asyncHandler(async (req, res) => {
  const { projectId, repoUrl, token } = req.body || {};

  if (!projectId) return failure(res, 400, "projectId is required");
  if (!repoUrl || !String(repoUrl).trim()) {
    return failure(res, 400, "repoUrl is required");
  }
  if (!token || !String(token).trim()) {
    return failure(res, 400, "token is required");
  }

  const { project, isOwner } = await getProjectForUser(projectId, req.user._id);
  if (!project) return failure(res, 404, "Project not found");
  if (!isOwner) {
    return failure(res, 403, "Only the project owner can connect a repository");
  }

  const parsed = parseGitHubRepoUrl(repoUrl);
  if (!parsed) {
    return failure(res, 400, "Invalid GitHub repository URL");
  }

  const existing = await Repository.findOne({ project: projectId });
  if (existing) {
    return failure(res, 409, "This project already has a connected repository");
  }

  const plainToken = String(token).trim();

  // Validate token + repo combo before persisting anything.
  try {
    await getContributors(parsed.owner, parsed.repoName, plainToken);
  } catch (err) {
    if (isGitHubAuthError(err)) {
      return failure(
        res,
        400,
        "Invalid token or repository - please check and try again"
      );
    }
    throw err;
  }

  let encryptedToken;
  let tokenIv;
  try {
    const enc = encrypt(plainToken);
    encryptedToken = enc.encryptedData;
    tokenIv = enc.iv;
  } catch (err) {
    if (err.message?.includes("GITHUB_TOKEN_ENCRYPTION_KEY")) {
      return failure(res, 500, "GitHub token encryption is not configured");
    }
    throw err;
  }

  const repo = await Repository.create({
    project: projectId,
    connectedBy: req.user._id,
    repoUrl: String(repoUrl).trim(),
    owner: parsed.owner,
    repoName: parsed.repoName,
    encryptedToken,
    tokenIv,
  });

  return success(res, 201, sanitizeRepository(repo), "Repository connected");
});

// GET /api/github/:projectId
export const getRepositoryData = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const { project, isOwner, isMember } = await getProjectForUser(
    projectId,
    req.user._id
  );
  if (!project) return failure(res, 404, "Project not found");
  if (!isOwner && !isMember) {
    return failure(res, 403, "Not authorized to view this project's repository");
  }

  const repo = await Repository.findOne({ project: projectId });
  if (!repo) return failure(res, 404, "No repository connected for this project");

  let plainToken;
  try {
    plainToken = decrypt(repo.encryptedToken, repo.tokenIv);
  } catch (err) {
    console.error("[github.controller] token decrypt failed:", err.message);
    return failure(res, 500, "Failed to decrypt stored GitHub token");
  }

  try {
    const [commits, pullRequests, contributors, issues, branches] =
      await Promise.all([
        getCommits(repo.owner, repo.repoName, plainToken),
        getPullRequests(repo.owner, repo.repoName, plainToken),
        getContributors(repo.owner, repo.repoName, plainToken),
        getIssues(repo.owner, repo.repoName, plainToken),
        getBranches(repo.owner, repo.repoName, plainToken),
      ]);

    repo.lastSyncedAt = new Date();
    await repo.save();

    return success(res, 200, {
      repository: sanitizeRepository(repo),
      commits,
      pullRequests,
      contributors,
      issues,
      branches,
    });
  } catch (err) {
    if (isGitHubAuthError(err)) {
      return failure(
        res,
        502,
        "Failed to fetch GitHub data — token may have expired or repo access was revoked"
      );
    }
    throw err;
  }
});

// DELETE /api/github/:projectId
export const disconnectRepository = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const { project, isOwner } = await getProjectForUser(projectId, req.user._id);
  if (!project) return failure(res, 404, "Project not found");
  if (!isOwner) {
    return failure(
      res,
      403,
      "Only the project owner can disconnect the repository"
    );
  }

  const repo = await Repository.findOneAndDelete({ project: projectId });
  if (!repo) {
    return failure(res, 404, "No repository connected for this project");
  }

  return success(res, 200, null, "Repository disconnected");
});
