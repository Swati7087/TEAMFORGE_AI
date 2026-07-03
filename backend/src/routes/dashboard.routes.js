// Dashboard routes.
//
//   GET /api/dashboard/summary       (protect)
//   GET /api/dashboard/productivity  (protect)
//
// Both endpoints scope aggregation to the current user's own projects, so
// there's no per-route authorization beyond `protect`.

import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  getSummary,
  getProductivity,
} from "../controllers/dashboard.controller.js";

const router = express.Router();

router.use(protect);

router.get("/summary", getSummary);
router.get("/productivity", getProductivity);

export default router;
