// AI routes.
//
// Phase 3 endpoints wired:
//   POST /api/ai/generate-project    (protect — any logged-in user)
//   POST /api/ai/generate-tasks      (protect — controller enforces project membership)
//
// Remaining Phase 3+ routes to land later:
//   /api/ai/match-team
//   /api/ai/meeting-summary
//   /api/ai/generate-readme
//   /api/ai/skill-gap
//   /api/ai/productivity-report
//   /api/ai/deadline-predict
//   /api/ai/conflict-resolver
//   /api/ai/risk-analysis

import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  generateProject,
  generateTasks,
} from "../controllers/ai.controller.js";

const router = express.Router();

router.use(protect);

router.post("/generate-project", generateProject);
router.post("/generate-tasks", generateTasks);

export default router;
