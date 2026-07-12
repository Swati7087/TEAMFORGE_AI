import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { getLatestContribution } from "../controllers/contribution.controller.js";

const router = express.Router();

router.use(protect);

router.get("/:projectId", getLatestContribution);

export default router;
