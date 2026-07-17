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

import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
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
} from "../controllers/ai.controller.js";

const router = express.Router();

router.use(protect);

router.post("/generate-project", generateProject);
router.post("/generate-tasks", generateTasks);
router.post("/productivity-report", generateProductivityReport);
router.post("/contribution-analysis", generateContributionAnalysis);
router.post("/match-team", matchTeam);
router.post("/skill-gap", analyzeSkillGap);
router.post("/meeting-summary", summarizeMeeting);
router.get("/meeting-history", getMeetingHistory);
router.post("/generate-readme", generateReadme);

export default router;
