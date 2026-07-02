import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  createTask,
  getTasksByProject,
  updateTask,
  deleteTask,
  updateTaskStatus,
} from "../controllers/task.controller.js";

const router = express.Router();

router.use(protect);

router.post("/", createTask);
router.get("/project/:projectId", getTasksByProject);
router.put("/:id", updateTask);
router.delete("/:id", deleteTask);
router.patch("/:id/status", updateTaskStatus);

export default router;
