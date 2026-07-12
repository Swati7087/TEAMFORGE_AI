// AI controller.
//
// Two Phase-3 endpoints:
//   POST /api/ai/generate-project  — any logged-in user, returns generated
//     scaffold for the CreateProject form to consume. Does NOT create a
//     Project document.
//   POST /api/ai/generate-tasks    — must be a member (owner or accepted) of
//     the referenced project. Returns generated task specs. Does NOT create
//     Task documents.
//
// Both endpoints log every call to AIHistory (success or failure).

import AIHistory from "../models/AIHistory.js";
import Project from "../models/Project.js";
import Task from "../models/Task.js";
import Repository from "../models/Repository.js";
import Contribution from "../models/Contribution.js";
import User from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { success, failure } from "../utils/apiResponse.js";
import { decrypt } from "../utils/encryption.js";
import { callGeminiJSON } from "../services/gemini.service.js";
import {
  getCommits,
  getContributors,
  getCommitDetails,
} from "../services/github.service.js";
import { buildProjectGeneratorPrompt } from "../prompts/projectGenerator.prompt.js";
import { buildTaskBreakdownPrompt } from "../prompts/taskBreakdown.prompt.js";
import { buildProductivityReportPrompt } from "../prompts/productivityReport.prompt.js";
import { buildContributionAnalyzerPrompt } from "../prompts/contributionAnalyzer.prompt.js";

const MAX_DETAIL_COMMITS = 50;

// Best-effort AIHistory writer. A logging failure MUST NOT shadow the real
// error the caller is trying to surface — otherwise a Mongo hiccup would
// return the wrong 500 to the client.
async function logAIHistory(entry) {
  try {
    await AIHistory.create(entry);
  } catch (logErr) {
    console.error("[ai.controller] failed to write AIHistory:", logErr.message);
  }
}

function truncate(str, n = 500) {
  if (typeof str !== "string") return "";
  return str.length > n ? str.slice(0, n) : str;
}

// POST /api/ai/generate-project
export const generateProject = asyncHandler(async (req, res) => {
  const { idea } = req.body || {};

  if (!idea || typeof idea !== "string" || !idea.trim()) {
    return failure(res, 400, "idea is required");
  }

  const cleanIdea = idea.trim();
  const prompt = buildProjectGeneratorPrompt(cleanIdea);

  try {
    const { parsed, raw } = await callGeminiJSON(prompt);

    await logAIHistory({
      user: req.user._id,
      project: null,
      type: "project-generation",
      input: cleanIdea,
      output: parsed,
      rawResponse: raw,
      status: "success",
    });

    return success(res, 200, parsed, "Project idea generated");
  } catch (err) {
    // Log the real error server-side but return a clean message to the client.
    console.error("[ai.controller] generateProject failed:", err.message);
    if (err.rawResponse) {
      console.error("[ai.controller] Gemini raw response:", truncate(err.rawResponse, 1000));
    }

    await logAIHistory({
      user: req.user._id,
      project: null,
      type: "project-generation",
      input: cleanIdea,
      output: null,
      rawResponse: err.rawResponse || "",
      status: "failed",
      errorMessage: truncate(err.message, 500),
    });

    return failure(res, 502, "AI generation failed, please try again");
  }
});

// POST /api/ai/generate-tasks
export const generateTasks = asyncHandler(async (req, res) => {
  const { projectId } = req.body || {};

  if (!projectId) {
    return failure(res, 400, "projectId is required");
  }

  const project = await Project.findById(projectId);
  if (!project) {
    return failure(res, 404, "Project not found");
  }

  // Reuse the Phase-2 auth pattern from getProjectById: owner OR member.
  const isOwner = project.owner.equals(req.user._id);
  const isMember = project.members.some((m) => m.equals(req.user._id));
  if (!isOwner && !isMember) {
    return failure(res, 403, "Not authorized to access this project");
  }

  const prompt = buildTaskBreakdownPrompt(
    project.title,
    project.description,
    project.techStack
  );

  const inputSnapshot = {
    projectId: String(project._id),
    title: project.title,
    description: project.description,
    techStack: project.techStack,
  };

  try {
    const { parsed, raw } = await callGeminiJSON(prompt);

    if (!Array.isArray(parsed)) {
      const shapeErr = new Error(
        "Gemini returned a non-array response for task breakdown"
      );
      shapeErr.rawResponse = raw;
      throw shapeErr;
    }

    await logAIHistory({
      user: req.user._id,
      project: project._id,
      type: "task-breakdown",
      input: inputSnapshot,
      output: parsed,
      rawResponse: raw,
      status: "success",
    });

    return success(res, 200, parsed, "Task breakdown generated");
  } catch (err) {
    console.error("[ai.controller] generateTasks failed:", err.message);
    if (err.rawResponse) {
      console.error("[ai.controller] Gemini raw response:", truncate(err.rawResponse, 1000));
    }

    await logAIHistory({
      user: req.user._id,
      project: project._id,
      type: "task-breakdown",
      input: inputSnapshot,
      output: null,
      rawResponse: err.rawResponse || "",
      status: "failed",
      errorMessage: truncate(err.message, 500),
    });

    return failure(res, 502, "AI generation failed, please try again");
  }
});

// POST /api/ai/productivity-report
// Weekly summary for a single project. Must be a member (owner or accepted).
// Buckets tasks into completed / pending / overdue, hands them to Gemini,
// returns { summary, highlights, concerns, suggestedNextSteps }.
export const generateProductivityReport = asyncHandler(async (req, res) => {
  const { projectId } = req.body || {};

  if (!projectId) {
    return failure(res, 400, "projectId is required");
  }

  const project = await Project.findById(projectId);
  if (!project) {
    return failure(res, 404, "Project not found");
  }

  const isOwner = project.owner.equals(req.user._id);
  const isMember = project.members.some((m) => m.equals(req.user._id));
  if (!isOwner && !isMember) {
    return failure(res, 403, "Not authorized to access this project");
  }

  // Pull all tasks for the project. Even a very active board is typically
  // well under 100 tasks — no need to page here.
  const tasks = await Task.find({ project: project._id })
    .select("title status priority difficulty deadline updatedAt")
    .lean();

  const now = new Date();
  const completed = [];
  const pending = [];
  const overdue = [];
  for (const t of tasks) {
    if (t.status === "done") {
      completed.push(t);
    } else {
      pending.push(t);
      if (t.deadline && new Date(t.deadline) < now) {
        overdue.push(t);
      }
    }
  }

  const prompt = buildProductivityReportPrompt(
    project.title,
    completed,
    pending,
    overdue
  );

  const inputSnapshot = {
    projectId: String(project._id),
    title: project.title,
    counts: {
      completed: completed.length,
      pending: pending.length,
      overdue: overdue.length,
    },
  };

  try {
    const { parsed, raw } = await callGeminiJSON(prompt);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      const shapeErr = new Error(
        "Gemini returned a non-object response for productivity report"
      );
      shapeErr.rawResponse = raw;
      throw shapeErr;
    }

    await logAIHistory({
      user: req.user._id,
      project: project._id,
      type: "productivity-report",
      input: inputSnapshot,
      output: parsed,
      rawResponse: raw,
      status: "success",
    });

    return success(res, 200, parsed, "Weekly summary generated");
  } catch (err) {
    console.error(
      "[ai.controller] generateProductivityReport failed:",
      err.message
    );
    if (err.rawResponse) {
      console.error(
        "[ai.controller] Gemini raw response:",
        truncate(err.rawResponse, 1000)
      );
    }

    await logAIHistory({
      user: req.user._id,
      project: project._id,
      type: "productivity-report",
      input: inputSnapshot,
      output: null,
      rawResponse: err.rawResponse || "",
      status: "failed",
      errorMessage: truncate(err.message, 500),
    });

    return failure(res, 502, "AI generation failed, please try again");
  }
});

function normalizeGithubUsername(value) {
  return String(value || "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
}

function isProjectMember(project, userId) {
  const isOwner = project.owner.equals(userId);
  const isMember = project.members.some((m) => m.equals(userId));
  return isOwner || isMember;
}

async function gatherContributionRawData(owner, repoName, token) {
  const [commits, githubContributors] = await Promise.all([
    getCommits(owner, repoName, token),
    getContributors(owner, repoName, token),
  ]);

  const commitsList = Array.isArray(commits) ? commits : [];
  const detailCount =
    commitsList.length <= MAX_DETAIL_COMMITS
      ? commitsList.length
      : MAX_DETAIL_COMMITS;
  const shasToDetail = commitsList
    .slice(0, detailCount)
    .map((c) => c.sha)
    .filter(Boolean);

  const detailResults = await Promise.all(
    shasToDetail.map((sha) =>
      getCommitDetails(owner, repoName, token, sha).catch((err) => {
        console.warn(
          `[ai.controller] getCommitDetails failed for ${sha}:`,
          err.message
        );
        return null;
      })
    )
  );

  const detailsBySha = new Map();
  shasToDetail.forEach((sha, i) => {
    if (detailResults[i]) detailsBySha.set(sha, detailResults[i]);
  });

  const byUsername = new Map();

  for (const c of commitsList) {
    const username =
      c.author?.login || c.commit?.author?.name || "unknown";
    if (!byUsername.has(username)) {
      byUsername.set(username, {
        githubUsername: username,
        commitCount: 0,
        linesAdded: 0,
        linesDeleted: 0,
        commitMessages: [],
        filePaths: new Set(),
      });
    }
    const entry = byUsername.get(username);
    entry.commitCount += 1;

    const msg = c.commit?.message?.split("\n")[0]?.trim();
    if (msg && entry.commitMessages.length < 25) {
      entry.commitMessages.push(msg);
    }

    const detail = detailsBySha.get(c.sha);
    if (detail) {
      entry.linesAdded += detail.stats?.additions || 0;
      entry.linesDeleted += detail.stats?.deletions || 0;
      for (const f of detail.files || []) {
        if (f.filename && entry.filePaths.size < 50) {
          entry.filePaths.add(f.filename);
        }
      }
    }
  }

  const contributorsRawData = [...byUsername.values()].map((e) => ({
    githubUsername: e.githubUsername,
    commitCount: e.commitCount,
    linesAdded: e.linesAdded,
    linesDeleted: e.linesDeleted,
    commitMessages: e.commitMessages,
    filePaths: [...e.filePaths],
  }));

  const rawStats = {
    totalCommits: commitsList.length,
    detailCommitsFetched: shasToDetail.length,
    githubContributorsCount: Array.isArray(githubContributors)
      ? githubContributors.length
      : 0,
    perContributor: contributorsRawData,
  };

  return { contributorsRawData, rawStats, byUsername };
}

function computeContributionPercentages(contributors) {
  const totalActivity = contributors.reduce(
    (sum, c) => sum + (c.linesAdded || 0) + (c.linesDeleted || 0),
    0
  );
  const totalCommits = contributors.reduce(
    (sum, c) => sum + (c.commitCount || 0),
    0
  );

  for (const c of contributors) {
    if (totalActivity > 0) {
      c.contributionPercentage =
        Math.round(
          (((c.linesAdded || 0) + (c.linesDeleted || 0)) / totalActivity) *
            1000
        ) / 10;
    } else if (totalCommits > 0) {
      c.contributionPercentage =
        Math.round(((c.commitCount || 0) / totalCommits) * 1000) / 10;
    } else {
      c.contributionPercentage = 0;
    }
  }

  const sum = contributors.reduce(
    (s, c) => s + (c.contributionPercentage || 0),
    0
  );
  if (contributors.length > 0 && sum !== 100) {
    const diff = Math.round((100 - sum) * 10) / 10;
    let maxIdx = 0;
    contributors.forEach((c, i) => {
      if (
        c.contributionPercentage > contributors[maxIdx].contributionPercentage
      ) {
        maxIdx = i;
      }
    });
    contributors[maxIdx].contributionPercentage =
      Math.round((contributors[maxIdx].contributionPercentage + diff) * 10) /
      10;
  }

  return contributors;
}

async function buildGithubUserMatchMap(project) {
  const userIds = [project.owner, ...project.members];
  const users = await User.find({ _id: { $in: userIds } }).select(
    "name githubProfile profilePicture"
  );
  const map = new Map();
  for (const u of users) {
    const gh = normalizeGithubUsername(u.githubProfile);
    if (gh) map.set(gh, u);
  }
  return { users, map };
}

// POST /api/ai/contribution-analysis
export const generateContributionAnalysis = asyncHandler(async (req, res) => {
  const { projectId } = req.body || {};

  if (!projectId) {
    return failure(res, 400, "projectId is required");
  }

  const project = await Project.findById(projectId);
  if (!project) {
    return failure(res, 404, "Project not found");
  }

  if (!isProjectMember(project, req.user._id)) {
    return failure(res, 403, "Not authorized to access this project");
  }

  const repo = await Repository.findOne({ project: projectId });
  if (!repo) {
    return failure(
      res,
      404,
      "No repository connected for this project — connect GitHub first"
    );
  }

  let plainToken;
  try {
    plainToken = decrypt(repo.encryptedToken, repo.tokenIv);
  } catch (err) {
    console.error("[ai.controller] token decrypt failed:", err.message);
    return failure(res, 500, "Failed to decrypt stored GitHub token");
  }

  const inputSnapshot = {
    projectId: String(project._id),
    repo: `${repo.owner}/${repo.repoName}`,
  };

  try {
    const { contributorsRawData, rawStats } = await gatherContributionRawData(
      repo.owner,
      repo.repoName,
      plainToken
    );

    if (contributorsRawData.length === 0) {
      return failure(res, 400, "No commits found in the connected repository");
    }

    const prompt = buildContributionAnalyzerPrompt(contributorsRawData);
    const { parsed, raw } = await callGeminiJSON(prompt);

    if (!Array.isArray(parsed)) {
      const shapeErr = new Error(
        "Gemini returned a non-array response for contribution analysis"
      );
      shapeErr.rawResponse = raw;
      throw shapeErr;
    }

    const aiByUsername = new Map();
    for (const entry of parsed) {
      if (entry?.githubUsername) {
        aiByUsername.set(entry.githubUsername, entry);
        aiByUsername.set(
          normalizeGithubUsername(entry.githubUsername),
          entry
        );
      }
    }

    const { map: userMatchMap } = await buildGithubUserMatchMap(project);

    const merged = contributorsRawData.map((rawContributor) => {
      const ai =
        aiByUsername.get(rawContributor.githubUsername) ||
        aiByUsername.get(
          normalizeGithubUsername(rawContributor.githubUsername)
        ) ||
        {};
      const matchedUser = userMatchMap.get(
        normalizeGithubUsername(rawContributor.githubUsername)
      );

      return {
        githubUsername: rawContributor.githubUsername,
        user: matchedUser?._id || null,
        commitCount: rawContributor.commitCount,
        linesAdded: rawContributor.linesAdded,
        linesDeleted: rawContributor.linesDeleted,
        areas: Array.isArray(ai.areas) ? ai.areas : [],
        summary: typeof ai.summary === "string" ? ai.summary : "",
        contributionPercentage: 0,
      };
    });

    computeContributionPercentages(merged);

    const saved = await Contribution.findOneAndUpdate(
      { project: project._id },
      {
        project: project._id,
        generatedAt: new Date(),
        contributors: merged,
        rawStats,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).populate("contributors.user", "name email profilePicture githubProfile");

    await logAIHistory({
      user: req.user._id,
      project: project._id,
      type: "contribution-analysis",
      input: inputSnapshot,
      output: {
        contributorCount: merged.length,
        contributors: merged.map((c) => ({
          githubUsername: c.githubUsername,
          areas: c.areas,
          summary: c.summary,
          contributionPercentage: c.contributionPercentage,
        })),
      },
      rawResponse: raw,
      status: "success",
    });

    return success(res, 200, saved, "Contribution analysis generated");
  } catch (err) {
    console.error(
      "[ai.controller] generateContributionAnalysis failed:",
      err.message
    );
    if (err.rawResponse) {
      console.error(
        "[ai.controller] Gemini raw response:",
        truncate(err.rawResponse, 1000)
      );
    }

    await logAIHistory({
      user: req.user._id,
      project: project._id,
      type: "contribution-analysis",
      input: inputSnapshot,
      output: null,
      rawResponse: err.rawResponse || "",
      status: "failed",
      errorMessage: truncate(err.message, 500),
    });

    return failure(res, 502, "AI generation failed, please try again");
  }
});
