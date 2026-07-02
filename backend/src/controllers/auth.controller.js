import User from "../models/User.js";
import { generateToken } from "../utils/generateToken.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { success, failure } from "../utils/apiResponse.js";
import { env } from "../config/env.js";

// POST /api/auth/signup
export const signup = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return failure(res, 400, "Name, email, and password are required");
  }

  const existing = await User.findOne({ email });
  if (existing) {
    return failure(res, 409, "Email already registered");
  }

  const user = await User.create({ name, email, password, authProvider: "local" });
  const token = generateToken(user._id);

  return success(res, 201, {
    token,
    user: { id: user._id, name: user.name, email: user.email },
  }, "Account created");
});

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return failure(res, 400, "Email and password are required");
  }

  // password field has select:false in schema, so explicitly request it
  const user = await User.findOne({ email }).select("+password");

  if (!user || user.authProvider !== "local") {
    return failure(res, 401, "Invalid credentials");
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return failure(res, 401, "Invalid credentials");
  }

  const token = generateToken(user._id);

  return success(res, 200, {
    token,
    user: { id: user._id, name: user.name, email: user.email },
  }, "Login successful");
});

// GET /api/auth/google/callback
// passport middleware (session:false) attaches req.user before this runs.
export const googleCallback = asyncHandler(async (req, res) => {
  const token = generateToken(req.user._id);
  // Redirect back to frontend with token as a query param.
  // Frontend grabs it from the URL and stores it, then cleans the URL.
  res.redirect(`${env.frontendUrl}/oauth-success?token=${token}`);
});

// GET /api/auth/me  (protected)
export const getMe = asyncHandler(async (req, res) => {
  return success(res, 200, { user: req.user }, "Current user");
});
