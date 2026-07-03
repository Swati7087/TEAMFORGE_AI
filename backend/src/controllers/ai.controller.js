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
import { asyncHandler } from "../utils/asyncHandler.js";
import { success, failure } from "../utils/apiResponse.js";
import { callGeminiJSON } from "../services/gemini.service.js";
import { buildProjectGeneratorPrompt } from "../prompts/projectGenerator.prompt.js";
import { buildTaskBreakdownPrompt } from "../prompts/taskBreakdown.prompt.js";

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
