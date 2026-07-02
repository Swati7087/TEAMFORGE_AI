import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  inviteToTeam,
  requestToJoin,
  respondToInvite,
  getTeamForProject,
  removeMember,
} from "../controllers/team.controller.js";

const router = express.Router();

router.use(protect);

router.post("/:projectId/invite", inviteToTeam);
router.post("/:projectId/request", requestToJoin);
router.patch("/:projectId/respond", respondToInvite);
router.get("/:projectId", getTeamForProject);
router.delete("/:projectId/members/:userId", removeMember);

export default router;
