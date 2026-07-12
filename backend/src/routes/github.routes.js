import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  connectRepository,
  getRepositoryData,
  disconnectRepository,
} from "../controllers/github.controller.js";

const router = express.Router();

router.use(protect);

router.post("/connect", connectRepository);
router.get("/:projectId", getRepositoryData);
router.delete("/:projectId", disconnectRepository);

export default router;
