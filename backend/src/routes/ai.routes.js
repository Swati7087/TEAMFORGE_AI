// AI routes.
//
// Wired endpoints:
//   POST /api/ai/generate-project     (Phase 3, protect — any logged-in user)
//   POST /api/ai/generate-tasks       (Phase 3, protect — controller enforces membership)
//   POST /api/ai/productivity-report  (Phase 4, protect — controller enforces membership)
//
// Remaining Phase 5+ routes to land later:
//   /api/ai/match-team
//   /api/ai/meeting-summary
//   /api/ai/generate-readme
//   /api/ai/skill-gap
//   /api/ai/deadline-predict
//   /api/ai/conflict-resolver
//   /api/ai/risk-analysis

import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  generateProject,
  generateTasks,
  generateProductivityReport,
  generateContributionAnalysis,
} from "../controllers/ai.controller.js";

const router = express.Router();

router.use(protect);

router.post("/generate-project", generateProject);
router.post("/generate-tasks", generateTasks);
router.post("/productivity-report", generateProductivityReport);
router.post("/contribution-analysis", generateContributionAnalysis);

export default router;
