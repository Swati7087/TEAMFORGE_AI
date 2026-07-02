// GET    /api/users            (protected) - list all users, minimal fields
// GET    /api/users/:id        (protected) - get one user's full profile
// PUT    /api/users/:id        (protected) - update own profile only

import express from "express";
import { getUsers, getUser, updateUser } from "../controllers/user.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", protect, getUsers);
router.get("/:id", protect, getUser);
router.put("/:id", protect, updateUser);

export default router;
