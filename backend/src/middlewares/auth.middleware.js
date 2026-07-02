import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import User from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { failure } from "../utils/apiResponse.js";

export const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return failure(res, 401, "Not authorized, no token provided");
  }

  const token = authHeader.split(" ")[1];

  let decoded;
  try {
    decoded = jwt.verify(token, env.jwtSecret);
  } catch (err) {
    return failure(res, 401, "Not authorized, token invalid or expired");
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    return failure(res, 401, "Not authorized, user no longer exists");
  }

  req.user = user; // full user doc available to downstream controllers
  next();
});
