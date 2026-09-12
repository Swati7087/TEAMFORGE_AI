// AI routes.
//
// Wired endpoints:
//   POST /api/ai/generate-project     (Phase 3, protect — any logged-in user)
//   POST /api/ai/generate-tasks       (Phase 3, protect — controller enforces membership)
//   POST /api/ai/productivity-report  (Phase 4, protect — controller enforces membership)
//   POST /api/ai/match-team           (Phase 6a, owner only)
//   POST /api/ai/skill-gap            (Phase 6a, member)
//   POST /api/ai/meeting-summary      (Phase 6b, member)
//   GET  /api/ai/meeting-history      (Phase 6b, member)
//   POST /api/ai/generate-readme      (Phase 6b, member)
//   POST /api/ai/bottleneck-detect    (Phase 6c, member)
//   POST /api/ai/deadline-predict     (Phase 6c, member)
//   POST /api/ai/risk-analysis        (Phase 6c, member)
//   POST /api/ai/conflict-resolve     (Phase 7 / merged 6d, member)
//   POST /api/ai/duplicate-work       (Phase 7 / merged 6d, member)
//   POST /api/ai/sprint-plan          (Phase 7 / merged 6d, member)
//   POST /api/ai/manager/chat         (Phase 7, member)
//   GET  /api/ai/manager/suggestions  (Phase 7, member)

import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { rateLimitAI } from "../middlewares/rateLimiter.middleware.js";
import {
  generateProject,
  generateTasks,
  generateProductivityReport,
  generateContributionAnalysis,
  matchTeam,
  analyzeSkillGap,
  summarizeMeeting,
  getMeetingHistory,
  generateReadme,
  detectBottlenecks,
  predictDeadline,
  analyzeProjectRisk,
  resolveConflict,
  detectDuplicateWork,
  planSprints,
} from "../controllers/ai.controller.js";
import {
  chatWithManager,
  getSuggestedPrompts,
} from "../controllers/aiManager.controller.js";

const router = express.Router();

router.use(protect);

// AI-generation routes — rate limited (these hit Gemini)
router.post("/generate-project", rateLimitAI, generateProject);
router.post("/generate-tasks", rateLimitAI, generateTasks);
router.post("/productivity-report", rateLimitAI, generateProductivityReport);
router.post("/contribution-analysis", rateLimitAI, generateContributionAnalysis);
router.post("/match-team", rateLimitAI, matchTeam);
router.post("/skill-gap", rateLimitAI, analyzeSkillGap);
router.post("/meeting-summary", rateLimitAI, summarizeMeeting);
router.post("/generate-readme", rateLimitAI, generateReadme);
router.post("/bottleneck-detect", rateLimitAI, detectBottlenecks);
router.post("/deadline-predict", rateLimitAI, predictDeadline);
router.post("/risk-analysis", rateLimitAI, analyzeProjectRisk);
router.post("/conflict-resolve", rateLimitAI, resolveConflict);
router.post("/duplicate-work", rateLimitAI, detectDuplicateWork);
router.post("/sprint-plan", rateLimitAI, planSprints);
router.post("/manager/chat", rateLimitAI, chatWithManager);

// Read-only routes — NOT rate limited (no Gemini call)
router.get("/meeting-history", getMeetingHistory);
router.get("/manager/suggestions", getSuggestedPrompts);

export default router;