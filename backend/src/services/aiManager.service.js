// AI Engineering Manager — tool registry + Gemini function-calling orchestration.
//
// Each tool handler mirrors the logic in ai.controller.js so prior phases
// are not wasted — the manager routes natural-language questions to the
// right analysis automatically.

import Project from "../models/Project.js";
import Task from "../models/Task.js";
import Team from "../models/Team.js";
import User from "../models/User.js";
import Repository from "../models/Repository.js";
import Contribution from "../models/Contribution.js";
import {
  callGeminiJSON,
  callGeminiChat,
  getModelParts,
  getTextFromParts,
  getFunctionCallsFromParts,
} from "./gemini.service.js";
import { computeTaskMetrics } from "../utils/taskAnalytics.js";
import { buildBottleneckPrompt } from "../prompts/bottleneckDetector.prompt.js";
import { buildDeadlinePredictorPrompt } from "../prompts/deadlinePredictor.prompt.js";
import { buildRiskAnalyzerPrompt } from "../prompts/riskAnalyzer.prompt.js";
import { buildTeamMatcherPrompt } from "../prompts/teamMatcher.prompt.js";
import { buildSkillGapPrompt } from "../prompts/skillGap.prompt.js";
import { buildDuplicateWorkPrompt } from "../prompts/duplicateWorkDetector.prompt.js";
import { buildSprintPlannerPrompt } from "../prompts/sprintPlanner.prompt.js";
import { buildConflictResolverPrompt } from "../prompts/conflictResolver.prompt.js";

const TOOL_LABELS = {
  checkBottlenecks: "Bottleneck Detector",
  predictDeadline: "Deadline Predictor",
  analyzeRisk: "Risk Analyzer",
  findTeamMatches: "Team Matcher",
  checkSkillGaps: "Skill Gap Detector",
  detectDuplicateWork: "Duplicate Work Detector",
  planSprints: "Sprint Planner",
  resolveConflict: "Conflict Resolver",
  getContributionSummary: "Contribution Analyzer",
};

function isProjectMember(project, userId) {
  const uid = String(userId);
  const ownerId = String(project.owner?._id || project.owner);
  if (ownerId === uid) return true;
  return (project.members || []).some((m) => String(m._id || m) === uid);
}

function parseTimelineWeeks(timeline) {
  const text = String(timeline || "").trim();
  if (!text) return 4;
  const match = text.match(/(\d+)\s*(?:week|wk|month|mo)/i);
  if (match) {
    const n = parseInt(match[1], 10);
    if (/month|mo/i.test(text)) return Math.min(12, n * 4);
    return Math.min(12, Math.max(1, n));
  }
  const num = parseInt(text, 10);
  if (!Number.isNaN(num) && num > 0) return Math.min(12, num);
  return 4;
}

async function loadProjectForTeamAI(projectId) {
  return Project.findById(projectId)
    .populate("owner", "name skills experienceLevel availability")
    .populate("members", "name skills experienceLevel availability");
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

function skillsOverlap(teamSkill, need) {
  const a = String(teamSkill).toLowerCase().replace(/[.\s_-]/g, "");
  const b = String(need).toLowerCase().replace(/[.\s_-]/g, "");
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function computeTeamSkillCoverage(project) {
  const teamSkills = flattenTeamSkills(project);
  const techStack = (project.techStack || [])
    .map((t) => String(t).trim())
    .filter(Boolean);

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

async function getProjectTasksAndMetrics(projectId) {
  const tasks = await Task.find({ project: projectId })
    .select(
      "title description status assignedTo deadline priority difficulty createdAt updatedAt"
    )
    .lean();
  return { tasks, metrics: computeTaskMetrics(tasks) };
}

export async function buildProjectContext(projectId, userId) {
  const project = await Project.findById(projectId)
    .populate("owner", "name skills githubProfile")
    .populate("members", "name skills githubProfile")
    .lean();

  if (!project) {
    return { error: { status: 404, message: "Project not found" } };
  }

  if (!isProjectMember(project, userId)) {
    return {
      error: { status: 403, message: "Not authorized to access this project" },
    };
  }

  const { tasks, metrics } = await getProjectTasksAndMetrics(projectId);

  const repo = await Repository.findOne({ project: projectId })
    .select("owner repoName lastSyncedAt")
    .lean();

  const contribution = await Contribution.findOne({ project: projectId })
    .select("generatedAt contributors rawStats")
    .lean();

  const teamNames = [
    project.owner?.name,
    ...(project.members || []).map((m) => m.name),
  ].filter(Boolean);

  return {
    project,
    tasks,
    metrics,
    github: repo
      ? {
          connected: true,
          repo: `${repo.owner}/${repo.repoName}`,
          lastSyncedAt: repo.lastSyncedAt,
          hasContributionAnalysis: !!contribution,
          contributorCount: contribution?.contributors?.length || 0,
        }
      : { connected: false },
    contribution: contribution
      ? {
          generatedAt: contribution.generatedAt,
          contributors: (contribution.contributors || []).map((c) => ({
            githubUsername: c.githubUsername,
            commitCount: c.commitCount,
            areas: c.areas,
            summary: c.summary,
            contributionPercentage: c.contributionPercentage,
          })),
          totalCommits: contribution.rawStats?.totalCommits || 0,
        }
      : null,
    teamSize: 1 + (project.members?.length || 0),
    teamNames,
    timelineWeeks: parseTimelineWeeks(project.timeline),
  };
}

function buildSystemInstruction(ctx) {
  const { project, tasks, metrics, github, contribution, teamNames } = ctx;

  const taskSummary = tasks.slice(0, 40).map((t) => ({
    id: String(t._id),
    title: t.title,
    status: t.status,
    priority: t.priority,
    deadline: t.deadline,
  }));

  return `You are the AI Engineering Manager for TeamForge AI — a smart teammate helping a student coding team manage their project.

You have access to tools that run real analyses on this project's data. When the user asks about bottlenecks, deadlines, risks, team matching, skill gaps, duplicate work, sprints, conflicts, or GitHub contributions — call the appropriate tool instead of guessing.

When no tool is needed, answer directly using the project context below. Be concise, practical, and reference real numbers and task titles from the context.

Project context (live data):
${JSON.stringify(
    {
      title: project.title,
      description: project.description,
      status: project.status,
      timeline: project.timeline,
      techStack: project.techStack,
      teamMembers: teamNames,
      metrics,
      tasks: taskSummary,
      totalTasks: tasks.length,
      github,
      contributionSummary: contribution
        ? {
            generatedAt: contribution.generatedAt,
            contributors: contribution.contributors,
            totalCommits: contribution.totalCommits,
          }
        : null,
    },
    null,
    2
  )}

Guidelines:
- Prefer calling a tool when the question maps to project analysis.
- After a tool returns data, explain findings in plain language for students.
- For team invites / "who should I join", use findTeamMatches (owner-only tool — if not owner, explain politely).
- For conflict mediation, use resolveConflict with the conversation text from the user's message.
- Keep replies under ~200 words unless the user asks for detail.`;
}

function buildToolDeclarations() {
  return [
    {
      functionDeclarations: [
        {
          name: "checkBottlenecks",
          description:
            "Detect project bottlenecks — overdue tasks, unassigned work, overloaded members, stale in-progress items.",
          parameters: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "predictDeadline",
          description:
            "Predict whether the project will hit its timeline/deadline based on current task progress and metrics.",
          parameters: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "analyzeRisk",
          description:
            "Analyze project risks across technical, team, and timeline categories.",
          parameters: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "findTeamMatches",
          description:
            "Find users to invite who fill skill gaps on the team. Best for 'who should I invite' questions.",
          parameters: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "checkSkillGaps",
          description:
            "Identify missing skills on the team relative to the project tech stack.",
          parameters: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "detectDuplicateWork",
          description:
            "Find overlapping or duplicate tasks that multiple people might be working on.",
          parameters: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "planSprints",
          description:
            "Generate a weekly sprint plan assigning tasks across the project timeline.",
          parameters: {
            type: "object",
            properties: {
              timelineWeeks: {
                type: "number",
                description:
                  "Number of weeks to plan (optional — defaults to project timeline).",
              },
            },
          },
        },
        {
          name: "resolveConflict",
          description:
            "Mediate a team conflict or dispute from conversation text provided by the user.",
          parameters: {
            type: "object",
            properties: {
              conversationText: {
                type: "string",
                description:
                  "The team conversation, messages, or dispute to analyze.",
              },
            },
            required: ["conversationText"],
          },
        },
        {
          name: "getContributionSummary",
          description:
            "Summarize GitHub contribution analysis — who worked on what areas of the codebase.",
          parameters: {
            type: "object",
            properties: {},
          },
        },
      ],
    },
  ];
}

const toolHandlers = {
  async checkBottlenecks({ ctx }) {
    const { project, metrics } = ctx;
    if (metrics.totalTasks === 0) {
      return {
        bottlenecks: [],
        summary: "No tasks yet — add tasks before running bottleneck analysis.",
      };
    }
    const { parsed } = await callGeminiJSON(
      buildBottleneckPrompt(project.title, metrics)
    );
    return {
      bottlenecks: Array.isArray(parsed.bottlenecks) ? parsed.bottlenecks : [],
      summary: parsed.summary || "Bottleneck analysis complete.",
    };
  },

  async predictDeadline({ ctx }) {
    const { project, metrics } = ctx;
    if (metrics.totalTasks === 0) {
      return {
        completionProbability: null,
        reasoning: "No tasks yet — add tasks before predicting the deadline.",
        riskFactors: [],
        recommendedActions: ["Create tasks for this project first"],
      };
    }
    if (!String(project.timeline || "").trim()) {
      return {
        completionProbability: null,
        reasoning: "Project timeline is not set — add a timeline first.",
        riskFactors: [],
        recommendedActions: ["Set a project timeline/deadline"],
      };
    }
    const { parsed } = await callGeminiJSON(
      buildDeadlinePredictorPrompt(project.title, project.timeline, metrics)
    );
    return {
      completionProbability:
        typeof parsed.completionProbability === "number"
          ? Math.min(100, Math.max(0, Math.round(parsed.completionProbability)))
          : null,
      reasoning: parsed.reasoning || "",
      riskFactors: Array.isArray(parsed.riskFactors) ? parsed.riskFactors : [],
      recommendedActions: Array.isArray(parsed.recommendedActions)
        ? parsed.recommendedActions
        : [],
    };
  },

  async analyzeRisk({ ctx }) {
    const { project, metrics } = ctx;
    if (metrics.totalTasks === 0) {
      return { risks: [], message: "No tasks yet — add tasks before risk analysis." };
    }
    const { parsed } = await callGeminiJSON(
      buildRiskAnalyzerPrompt(project.title, project.techStack || [], metrics)
    );
    return { risks: Array.isArray(parsed.risks) ? parsed.risks : [] };
  },

  async findTeamMatches({ ctx, userId }) {
    const project = await loadProjectForTeamAI(ctx.project._id);
    const ownerId = project.owner?._id || project.owner;
    if (!ownerId.equals(userId)) {
      return {
        error:
          "Only the project owner can search for teammates to invite. Ask the owner to run Team Matcher, or use checkSkillGaps to see what's missing.",
        matches: [],
      };
    }

    const team = await Team.findOne({ project: ctx.project._id });
    const excludedIds = [...collectExcludedUserIds(project, team)];

    let candidates = await User.find({ _id: { $nin: excludedIds } })
      .select("name skills experienceLevel availability bio profilePicture")
      .lean();

    if (candidates.length === 0) {
      return { matches: [], message: "No candidates available to match." };
    }

    const projectRequirements = buildProjectRequirements(project);
    const skillCoverage = computeTeamSkillCoverage(project);
    const { teamSkills, missingSkills } = skillCoverage;

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

    const candidateMap = new Map(candidates.map((u) => [String(u._id), u]));

    const { parsed } = await callGeminiJSON(
      buildTeamMatcherPrompt(
        projectRequirements,
        candidateUsers,
        skillCoverage
      )
    );

    if (!Array.isArray(parsed)) {
      return { matches: [], message: "Team matcher returned unexpected data." };
    }

    const validIds = new Set(candidateUsers.map((c) => c.userId));
    const matches = parsed
      .filter((m) => m?.userId && validIds.has(String(m.userId)))
      .slice(0, 8)
      .map((m) => {
        const user = candidateMap.get(String(m.userId));
        return {
          userId: String(m.userId),
          name: user?.name || "Unknown",
          skills: user?.skills || [],
          matchScore: Math.min(100, Math.max(0, Number(m.matchScore) || 0)),
          reason: typeof m.reason === "string" ? m.reason.trim() : "",
        };
      });

    return { matches, missingSkills: skillCoverage.missingSkills };
  },

  async checkSkillGaps({ ctx }) {
    const project = await loadProjectForTeamAI(ctx.project._id);
    const projectRequirements = buildProjectRequirements(project);
    const teamSkills = flattenTeamSkills(project);
    const { parsed } = await callGeminiJSON(
      buildSkillGapPrompt(projectRequirements, teamSkills)
    );
    return {
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
  },

  async detectDuplicateWork({ ctx }) {
    const { tasks } = ctx;
    if (tasks.length < 2) {
      return { duplicates: [], message: "Need at least 2 tasks to compare." };
    }
    const { parsed } = await callGeminiJSON(buildDuplicateWorkPrompt(tasks));
    const validIds = new Set(tasks.map((t) => String(t._id)));
    const duplicates = (Array.isArray(parsed.duplicates) ? parsed.duplicates : [])
      .map((d) => ({
        taskIds: (Array.isArray(d.taskIds) ? d.taskIds : [])
          .map(String)
          .filter((id) => validIds.has(id)),
        reason: typeof d.reason === "string" ? d.reason.trim() : "",
      }))
      .filter((d) => d.taskIds.length >= 2);
    return { duplicates };
  },

  async planSprints({ ctx, args }) {
    const { project, tasks } = ctx;
    const teamSize = 1 + (project.members?.length || 0);
    const timelineWeeks =
      args?.timelineWeeks != null
        ? Math.min(12, Math.max(1, Number(args.timelineWeeks) || 4))
        : ctx.timelineWeeks;

    const { parsed } = await callGeminiJSON(
      buildSprintPlannerPrompt(tasks, teamSize, timelineWeeks)
    );
    const validIds = new Set(tasks.map((t) => String(t._id)));
    const sprints = (Array.isArray(parsed.sprints) ? parsed.sprints : [])
      .map((s) => ({
        week: Math.max(1, Math.min(timelineWeeks, Number(s.week) || 1)),
        focus: typeof s.focus === "string" ? s.focus.trim() : "",
        taskIds: (Array.isArray(s.taskIds) ? s.taskIds : [])
          .map(String)
          .filter((id) => validIds.has(id)),
      }))
      .filter((s) => s.focus || s.taskIds.length > 0);

    return { sprints, teamSize, timelineWeeks };
  },

  async resolveConflict({ args, message }) {
    const text =
      args?.conversationText?.trim() ||
      message?.trim() ||
      "";
    if (!text) {
      return {
        error:
          "No conversation text provided. Paste the team messages or describe the conflict.",
      };
    }
    const { parsed } = await callGeminiJSON(buildConflictResolverPrompt(text));
    return {
      mainIssue: String(parsed.mainIssue || "").trim(),
      neutralSummary: String(parsed.neutralSummary || "").trim(),
      suggestedResolution: String(parsed.suggestedResolution || "").trim(),
    };
  },

  async getContributionSummary({ ctx }) {
    if (!ctx.github?.connected) {
      return {
        error:
          "No GitHub repository connected. Connect a repo on the GitHub tab first.",
      };
    }
    if (!ctx.contribution) {
      return {
        error:
          "No contribution analysis yet. Run the Contribution Analyzer on the GitHub tab first.",
        repo: ctx.github.repo,
      };
    }
    return {
      repo: ctx.github.repo,
      generatedAt: ctx.contribution.generatedAt,
      totalCommits: ctx.contribution.totalCommits,
      contributors: ctx.contribution.contributors,
    };
  },
};

async function executeTool(toolName, { ctx, userId, args, message }) {
  const handler = toolHandlers[toolName];
  if (!handler) {
    return { error: `Unknown tool: ${toolName}` };
  }
  return handler({ ctx, userId, args, message });
}

function historyToContents(conversationHistory, newMessage) {
  const contents = [];

  for (const turn of conversationHistory || []) {
    const role = turn.role === "assistant" ? "model" : "user";
    const text = String(turn.content || turn.text || "").trim();
    if (text) {
      contents.push({ role, parts: [{ text }] });
    }
  }

  contents.push({ role: "user", parts: [{ text: String(newMessage).trim() }] });
  return contents;
}

export function getSuggestedPromptsList() {
  return [
    {
      label: "Check bottlenecks",
      prompt: "What's blocking this project?",
      toolHint: "checkBottlenecks",
    },
    {
      label: "Predict deadline",
      prompt: "Will we hit our project deadline?",
      toolHint: "predictDeadline",
    },
    {
      label: "Analyze risks",
      prompt: "What are the biggest risks on this project?",
      toolHint: "analyzeRisk",
    },
    {
      label: "Find teammates",
      prompt: "Who should I invite to join the team next?",
      toolHint: "findTeamMatches",
    },
    {
      label: "Check skill gaps",
      prompt: "What skills is our team missing?",
      toolHint: "checkSkillGaps",
    },
    {
      label: "Find duplicate work",
      prompt: "Are any of our tasks overlapping or duplicated?",
      toolHint: "detectDuplicateWork",
    },
    {
      label: "Plan next sprint",
      prompt: "Help me plan the next few sprints for this project.",
      toolHint: "planSprints",
    },
    {
      label: "Project overview",
      prompt: "How's the project going overall?",
      toolHint: null,
    },
  ];
}

export function getToolLabel(toolName) {
  return TOOL_LABELS[toolName] || toolName;
}

export async function runManagerChat({
  projectId,
  userId,
  message,
  conversationHistory = [],
}) {
  const cleanMessage = String(message || "").trim();
  if (!cleanMessage) {
    const err = new Error("message is required");
    err.status = 400;
    throw err;
  }

  const ctx = await buildProjectContext(projectId, userId);
  if (ctx.error) {
    const err = new Error(ctx.error.message);
    err.status = ctx.error.status;
    throw err;
  }

  const systemInstruction = buildSystemInstruction(ctx);
  const contents = historyToContents(conversationHistory, cleanMessage);
  const tools = buildToolDeclarations();

  let response = await callGeminiChat({
    systemInstruction,
    contents,
    tools,
    toolConfig: { functionCallingConfig: { mode: "AUTO" } },
  });

  let parts = getModelParts(response);
  let functionCalls = getFunctionCallsFromParts(parts);
  let toolUsed = null;
  let toolResult = null;

  if (functionCalls.length > 0) {
    const call = functionCalls[0];
    toolUsed = call.name;
    toolResult = await executeTool(call.name, {
      ctx,
      userId,
      args: call.args || {},
      message: cleanMessage,
    });

    // Preserve the model's original parts (incl. thought_signature) — required
    // by newer Gemini models when echoing functionCall back in multi-turn.
    const followUpContents = [
      ...contents,
      { role: "model", parts },
      {
        role: "user",
        parts: [
          {
            functionResponse: {
              name: call.name,
              response: { result: toolResult },
            },
          },
        ],
      },
    ];

    response = await callGeminiChat({
      systemInstruction,
      contents: followUpContents,
    });
    parts = getModelParts(response);
  }

  let reply = getTextFromParts(parts);
  if (!reply) {
    reply =
      "I couldn't generate a response. Try rephrasing your question or pick a quick action below.";
  }

  return {
    reply,
    toolUsed,
    toolLabel: toolUsed ? getToolLabel(toolUsed) : null,
    toolResult,
  };
}

export { toolHandlers, TOOL_LABELS };
