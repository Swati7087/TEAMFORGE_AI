import AIHistory from "../models/AIHistory.js";
import Project from "../models/Project.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { success, failure } from "../utils/apiResponse.js";
import { geminiUserMessage } from "../services/gemini.service.js";
import {
  runManagerChat,
  getSuggestedPromptsList,
} from "../services/aiManager.service.js";

function truncate(str, n = 500) {
  if (typeof str !== "string") return "";
  return str.length > n ? str.slice(0, n) : str;
}

async function logAIHistory(entry) {
  try {
    await AIHistory.create(entry);
  } catch (logErr) {
    console.error("[aiManager.controller] failed to write AIHistory:", logErr.message);
  }
}

function isProjectMember(project, userId) {
  const uid = String(userId);
  const ownerId = String(project.owner?._id || project.owner);
  if (ownerId === uid) return true;
  return (project.members || []).some((m) => String(m._id || m) === uid);
}

function aiFailureStatus(err) {
  return err?.status === 429 ? 429 : err?.status === 403 ? 403 : err?.status === 404 ? 404 : err?.status === 400 ? 400 : 502;
}

// POST /api/ai/manager/chat
export const chatWithManager = asyncHandler(async (req, res) => {
  const { projectId, message, conversationHistory } = req.body || {};

  if (!projectId) {
    return failure(res, 400, "projectId is required");
  }

  try {
    const result = await runManagerChat({
      projectId,
      userId: req.user._id,
      message,
      conversationHistory: Array.isArray(conversationHistory)
        ? conversationHistory
        : [],
    });

    await logAIHistory({
      user: req.user._id,
      project: projectId,
      type: "engineering-manager",
      input: {
        projectId: String(projectId),
        message: truncate(String(message || ""), 1000),
        historyLength: Array.isArray(conversationHistory)
          ? conversationHistory.length
          : 0,
      },
      output: {
        reply: result.reply,
        toolUsed: result.toolUsed,
        toolLabel: result.toolLabel,
      },
      rawResponse: result.reply,
      status: "success",
    });

    return success(
      res,
      200,
      {
        reply: result.reply,
        toolUsed: result.toolUsed,
        toolLabel: result.toolLabel,
      },
      "Manager reply generated"
    );
  } catch (err) {
    console.error("[aiManager.controller] chatWithManager failed:", err.message);

    await logAIHistory({
      user: req.user._id,
      project: projectId,
      type: "engineering-manager",
      input: {
        projectId: String(projectId),
        message: truncate(String(message || ""), 1000),
      },
      output: null,
      rawResponse: err.rawResponse || "",
      status: "failed",
      errorMessage: truncate(err.message, 500),
    });

    return failure(
      res,
      aiFailureStatus(err),
      err.status >= 400 && err.status < 500 && err.status !== 429
        ? err.message
        : geminiUserMessage(err)
    );
  }
});

// GET /api/ai/manager/suggestions?projectId=
export const getSuggestedPrompts = asyncHandler(async (req, res) => {
  const { projectId } = req.query;

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

  return success(res, 200, getSuggestedPromptsList(), "Suggestions fetched");
});
