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
import { callGemini, callGeminiJSON, geminiUserMessage } from "../services/gemini.service.js";
import {
  getCommits,
  getContributors,
  getCommitDetails,
} from "../services/github.service.js";
import { buildProjectGeneratorPrompt } from "../prompts/projectGenerator.prompt.js";
import { buildTaskBreakdownPrompt } from "../prompts/taskBreakdown.prompt.js";
import { buildProductivityReportPrompt } from "../prompts/productivityReport.prompt.js";
import { buildContributionAnalyzerPrompt } from "../prompts/contributionAnalyzer.prompt.js";
import { buildTeamMatcherPrompt } from "../prompts/teamMatcher.prompt.js";
import { buildSkillGapPrompt } from "../prompts/skillGap.prompt.js";
import { buildMeetingSummaryPrompt } from "../prompts/meetingSummary.prompt.js";
import { buildReadmePrompt } from "../prompts/readmeGenerator.prompt.js";
import Team from "../models/Team.js";
import Meeting from "../models/Meeting.js";

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

function aiFailureStatus(err) {
  return err?.status === 429 ? 429 : 502;
}

function respondAIFailure(res, err) {
  return failure(res, aiFailureStatus(err), geminiUserMessage(err));
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

    return respondAIFailure(res, err);
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

    return respondAIFailure(res, err);
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

    return respondAIFailure(res, err);
  }
});

function normalizeGithubUsername(value) {
  return String(value || "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
}

function isProjectMember(project, userId) {
  const ownerId = project.owner?._id || project.owner;
  const isOwner = ownerId.equals(userId);
  const isMember = project.members.some((m) => {
    const memberId = m._id || m;
    return memberId.equals(userId);
  });
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

    return respondAIFailure(res, err);
  }
});

async function loadProjectForTeamAI(projectId) {
  return Project.findById(projectId)
    .populate("owner", "name skills experienceLevel availability")
    .populate("members", "name skills experienceLevel availability");
}

function collectExcludedUserIds(project, team) {
  const excluded = new Set();
  const ownerId = project.owner?._id || project.owner;
  if (ownerId) excluded.add(String(ownerId));

  for (const m of project.members || []) {
    const id = m._id || m;
    if (id) excluded.add(String(id));
  }

  if (team?.members) {
    for (const entry of team.members) {
      if (["invited", "requested", "accepted"].includes(entry.status)) {
        excluded.add(String(entry.user));
      }
    }
  }

  return excluded;
}

function buildProjectRequirements(project) {
  const currentMemberSkills = [];
  const members = [];

  if (project.owner) {
    const ownerSkills = project.owner.skills || [];
    currentMemberSkills.push(...ownerSkills);
    members.push({
      name: project.owner.name,
      role: "owner",
      skills: ownerSkills,
      experienceLevel: project.owner.experienceLevel,
    });
  }

  for (const m of project.members || []) {
    const skills = m.skills || [];
    currentMemberSkills.push(...skills);
    members.push({
      name: m.name,
      role: "member",
      skills,
      experienceLevel: m.experienceLevel,
    });
  }

  return {
    title: project.title,
    description: project.description || "",
    techStack: project.techStack || [],
    currentMemberSkills,
    members,
  };
}

function flattenTeamSkills(project) {
  const skills = [];
  if (project.owner?.skills) skills.push(...project.owner.skills);
  for (const m of project.members || []) {
    if (m.skills) skills.push(...m.skills);
  }
  const seen = new Set();
  return skills.filter((s) => {
    const key = String(s).trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Normalize skill comparison — "node js" matches "Node.js", etc.
function skillsOverlap(teamSkill, need) {
  const a = String(teamSkill).toLowerCase().replace(/[.\s_-]/g, "");
  const b = String(need).toLowerCase().replace(/[.\s_-]/g, "");
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

// Same deterministic coverage logic used before Team Matcher + Skill Gap prompts.
function computeTeamSkillCoverage(project) {
  const teamSkills = flattenTeamSkills(project);
  const techStack = (project.techStack || []).map((t) => String(t).trim()).filter(Boolean);

  const alreadyCovered = [...teamSkills];
  const missingSkills = [];

  for (const tech of techStack) {
    const coveredByTeam = teamSkills.some((ts) => skillsOverlap(ts, tech));
    if (coveredByTeam) {
      const alreadyListed = alreadyCovered.some((c) => skillsOverlap(c, tech));
      if (!alreadyListed) alreadyCovered.push(tech);
    } else {
      missingSkills.push(tech);
    }
  }

  return { alreadyCovered, missingSkills, teamSkills };
}

function gapFillPrefilterScore(userSkills, teamSkills, missingSkills) {
  const teamNorm = teamSkills.map((s) => String(s).toLowerCase().trim());

  return (userSkills || []).reduce((score, skill) => {
    const duplicatesTeam = teamNorm.some((t) => skillsOverlap(skill, t));
    if (duplicatesTeam) {
      score -= 3;
    } else {
      score += 2;
    }

    for (const gap of missingSkills) {
      if (skillsOverlap(skill, gap)) score += 5;
    }

    return score;
  }, 0);
}

// POST /api/ai/match-team — owner only
export const matchTeam = asyncHandler(async (req, res) => {
  const { projectId } = req.body || {};

  if (!projectId) {
    return failure(res, 400, "projectId is required");
  }

  const project = await loadProjectForTeamAI(projectId);
  if (!project) {
    return failure(res, 404, "Project not found");
  }

  if (!project.owner._id.equals(req.user._id)) {
    return failure(res, 403, "Only the project owner can match teammates");
  }

  const team = await Team.findOne({ project: projectId });
  const excludedIds = collectExcludedUserIds(project, team);
  const excludedObjectIds = [...excludedIds];

  // TODO: at scale, pre-filter candidates by shared interests, availability,
  // or skill overlap before sending to Gemini — don't ship hundreds of users.
  let candidates = await User.find({
    _id: { $nin: excludedObjectIds },
  })
    .select("name skills experienceLevel availability bio profilePicture")
    .lean();

  if (candidates.length === 0) {
    return success(res, 200, [], "No candidates available to match");
  }

  const projectRequirements = buildProjectRequirements(project);
  const skillCoverage = computeTeamSkillCoverage(project);
  const { teamSkills, missingSkills } = skillCoverage;

  // Pre-rank: gap-fillers first, penalize duplicate-skill candidates.
  candidates = candidates
    .map((u) => ({
      ...u,
      _prefilterScore: gapFillPrefilterScore(
        u.skills,
        teamSkills,
        missingSkills
      ),
    }))
    .sort((a, b) => b._prefilterScore - a._prefilterScore)
    .slice(0, 30);

  const candidateUsers = candidates.map((u) => ({
    userId: String(u._id),
    name: u.name,
    skills: u.skills || [],
    experienceLevel: u.experienceLevel || "beginner",
    availability: u.availability || "medium",
    interests: u.bio || "",
  }));

  const candidateMap = new Map(
    candidates.map((u) => [String(u._id), u])
  );

  const inputSnapshot = {
    projectId: String(project._id),
    candidateCount: candidateUsers.length,
    techStack: project.techStack,
    alreadyCovered: skillCoverage.alreadyCovered,
    missingSkills: skillCoverage.missingSkills,
  };

  const prompt = buildTeamMatcherPrompt(
    projectRequirements,
    candidateUsers,
    skillCoverage
  );

  try {
    const { parsed, raw } = await callGeminiJSON(prompt);

    if (!Array.isArray(parsed)) {
      const shapeErr = new Error(
        "Gemini returned a non-array response for team match"
      );
      shapeErr.rawResponse = raw;
      throw shapeErr;
    }

    const validIds = new Set(candidateUsers.map((c) => c.userId));
    const matches = parsed
      .filter((m) => m?.userId && validIds.has(String(m.userId)))
      .slice(0, 8)
      .map((m) => {
        const user = candidateMap.get(String(m.userId));
        const score = Math.min(
          100,
          Math.max(0, Number(m.matchScore) || 0)
        );
        return {
          userId: String(m.userId),
          name: user?.name || "Unknown",
          profilePicture: user?.profilePicture || null,
          skills: user?.skills || [],
          experienceLevel: user?.experienceLevel || "beginner",
          availability: user?.availability || "medium",
          matchScore: score,
          reason: typeof m.reason === "string" ? m.reason.trim() : "",
        };
      });

    await logAIHistory({
      user: req.user._id,
      project: project._id,
      type: "team-match",
      input: inputSnapshot,
      output: matches,
      rawResponse: raw,
      status: "success",
    });

    return success(res, 200, matches, "Team matches generated");
  } catch (err) {
    console.error("[ai.controller] matchTeam failed:", err.message);
    if (err.rawResponse) {
      console.error(
        "[ai.controller] Gemini raw response:",
        truncate(err.rawResponse, 1000)
      );
    }

    await logAIHistory({
      user: req.user._id,
      project: project._id,
      type: "team-match",
      input: inputSnapshot,
      output: null,
      rawResponse: err.rawResponse || "",
      status: "failed",
      errorMessage: truncate(err.message, 500),
    });

    return respondAIFailure(res, err);
  }
});

// POST /api/ai/skill-gap — project member only
export const analyzeSkillGap = asyncHandler(async (req, res) => {
  const { projectId } = req.body || {};

  if (!projectId) {
    return failure(res, 400, "projectId is required");
  }

  const project = await loadProjectForTeamAI(projectId);
  if (!project) {
    return failure(res, 404, "Project not found");
  }

  if (!isProjectMember(project, req.user._id)) {
    return failure(res, 403, "Not authorized to access this project");
  }

  const projectRequirements = buildProjectRequirements(project);
  const teamSkills = flattenTeamSkills(project);

  const inputSnapshot = {
    projectId: String(project._id),
    techStack: project.techStack,
    teamSkillCount: teamSkills.length,
  };

  const prompt = buildSkillGapPrompt(projectRequirements, teamSkills);

  try {
    const { parsed, raw } = await callGeminiJSON(prompt);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      const shapeErr = new Error(
        "Gemini returned a non-object response for skill gap"
      );
      shapeErr.rawResponse = raw;
      throw shapeErr;
    }

    const result = {
      missingSkills: Array.isArray(parsed.missingSkills)
        ? parsed.missingSkills
        : [],
      coveredSkills: Array.isArray(parsed.coveredSkills)
        ? parsed.coveredSkills
        : [],
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations
        : [],
    };

    await logAIHistory({
      user: req.user._id,
      project: project._id,
      type: "skill-gap",
      input: inputSnapshot,
      output: result,
      rawResponse: raw,
      status: "success",
    });

    return success(res, 200, result, "Skill gap analysis generated");
  } catch (err) {
    console.error("[ai.controller] analyzeSkillGap failed:", err.message);
    if (err.rawResponse) {
      console.error(
        "[ai.controller] Gemini raw response:",
        truncate(err.rawResponse, 1000)
      );
    }

    await logAIHistory({
      user: req.user._id,
      project: project._id,
      type: "skill-gap",
      input: inputSnapshot,
      output: null,
      rawResponse: err.rawResponse || "",
      status: "failed",
      errorMessage: truncate(err.message, 500),
    });

    return respondAIFailure(res, err);
  }
});

function collectTeamMemberNames(project) {
  const names = [];
  if (project.owner?.name) names.push(project.owner.name);
  for (const m of project.members || []) {
    if (m.name) names.push(m.name);
  }
  return [...new Set(names)];
}

async function loadProjectForMeetingAI(projectId) {
  return Project.findById(projectId)
    .populate("owner", "name")
    .populate("members", "name");
}

// POST /api/ai/meeting-summary — project member only
export const summarizeMeeting = asyncHandler(async (req, res) => {
  const { projectId, rawNotes } = req.body || {};

  if (!projectId) {
    return failure(res, 400, "projectId is required");
  }
  if (!rawNotes || typeof rawNotes !== "string" || !rawNotes.trim()) {
    return failure(res, 400, "rawNotes is required");
  }

  const project = await loadProjectForMeetingAI(projectId);
  if (!project) {
    return failure(res, 404, "Project not found");
  }

  if (!isProjectMember(project, req.user._id)) {
    return failure(res, 403, "Not authorized to access this project");
  }

  const cleanNotes = rawNotes.trim();
  const teamMemberNames = collectTeamMemberNames(project);
  const inputSnapshot = {
    projectId: String(project._id),
    rawNotesLength: cleanNotes.length,
    teamMemberNames,
  };

  const prompt = buildMeetingSummaryPrompt(cleanNotes, teamMemberNames);

  try {
    const { parsed, raw } = await callGeminiJSON(prompt);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      const shapeErr = new Error(
        "Gemini returned a non-object response for meeting summary"
      );
      shapeErr.rawResponse = raw;
      throw shapeErr;
    }

    const result = {
      summary: String(parsed.summary || "").trim(),
      actionItems: Array.isArray(parsed.actionItems)
        ? parsed.actionItems.map((item) => ({
            task: String(item?.task || "").trim(),
            assignedTo: String(item?.assignedTo || "Unassigned").trim(),
            priority: ["low", "medium", "high"].includes(item?.priority)
              ? item.priority
              : "medium",
          }))
        : [],
      nextMeetingGoals: Array.isArray(parsed.nextMeetingGoals)
        ? parsed.nextMeetingGoals.map((g) => String(g).trim()).filter(Boolean)
        : [],
    };

    const meeting = await Meeting.create({
      project: project._id,
      rawNotes: cleanNotes,
      summary: result.summary,
      actionItems: result.actionItems,
      nextMeetingGoals: result.nextMeetingGoals,
      createdBy: req.user._id,
    });

    await logAIHistory({
      user: req.user._id,
      project: project._id,
      type: "meeting-summary",
      input: inputSnapshot,
      output: result,
      rawResponse: raw,
      status: "success",
    });

    return success(
      res,
      200,
      { ...result, meetingId: String(meeting._id) },
      "Meeting summary generated"
    );
  } catch (err) {
    console.error("[ai.controller] summarizeMeeting failed:", err.message);
    if (err.rawResponse) {
      console.error(
        "[ai.controller] Gemini raw response:",
        truncate(err.rawResponse, 1000)
      );
    }

    await logAIHistory({
      user: req.user._id,
      project: project._id,
      type: "meeting-summary",
      input: inputSnapshot,
      output: null,
      rawResponse: err.rawResponse || "",
      status: "failed",
      errorMessage: truncate(err.message, 500),
    });

    return respondAIFailure(res, err);
  }
});

// GET /api/ai/meeting-history?projectId= — project member only
export const getMeetingHistory = asyncHandler(async (req, res) => {
  const projectId = req.query.projectId;

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

  const meetings = await Meeting.find({ project: projectId })
    .sort({ createdAt: -1 })
    .select("summary actionItems nextMeetingGoals createdAt createdBy")
    .populate("createdBy", "name")
    .lean();

  const history = meetings.map((m) => ({
    meetingId: String(m._id),
    summary: m.summary,
    actionItems: m.actionItems || [],
    nextMeetingGoals: m.nextMeetingGoals || [],
    createdAt: m.createdAt,
    createdByName: m.createdBy?.name || "Unknown",
  }));

  return success(res, 200, history, "Meeting history fetched");
});

// POST /api/ai/generate-readme — project member only
export const generateReadme = asyncHandler(async (req, res) => {
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

  const tasks = await Task.find({ project: projectId })
    .select("title description status priority")
    .lean();

  const inputSnapshot = {
    projectId: String(project._id),
    title: project.title,
    techStack: project.techStack || [],
    taskCount: tasks.length,
  };

  const prompt = buildReadmePrompt(
    project,
    tasks,
    project.techStack || []
  );

  try {
    const markdown = await callGemini(prompt);
    const trimmed = markdown.trim();

    await logAIHistory({
      user: req.user._id,
      project: project._id,
      type: "readme",
      input: inputSnapshot,
      output: trimmed,
      rawResponse: trimmed,
      status: "success",
    });

    return success(res, 200, { markdown: trimmed }, "README generated");
  } catch (err) {
    console.error("[ai.controller] generateReadme failed:", err.message);
    if (err.rawResponse) {
      console.error(
        "[ai.controller] Gemini raw response:",
        truncate(err.rawResponse, 1000)
      );
    }

    await logAIHistory({
      user: req.user._id,
      project: project._id,
      type: "readme",
      input: inputSnapshot,
      output: null,
      rawResponse: err.rawResponse || "",
      status: "failed",
      errorMessage: truncate(err.message, 500),
    });

    return respondAIFailure(res, err);
  }
});
