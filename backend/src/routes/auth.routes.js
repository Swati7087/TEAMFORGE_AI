// POST   /api/auth/signup
// POST   /api/auth/login
// GET    /api/auth/google
// GET    /api/auth/google/callback
// GET    /api/auth/me            (protected)

import express from "express";
import passport from "../config/passport.js";
import { signup, login, googleCallback, getMe } from "../controllers/auth.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"], session: false })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/login" }),
  googleCallback
);

router.get("/me", protect, getMe);

export default router;
