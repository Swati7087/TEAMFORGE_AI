import { redis } from "../services/redis.service.js";
import { failure } from "../utils/apiResponse.js";

const DAILY_LIMIT = 15; // Gemini free tier se thoda kam, safety margin ke liye

export async function rateLimitAI(req, res, next) {
  if (!redis) {
    return next(); // Redis na ho to rate limiting skip, block mat karo
  }

  const userId = req.user._id.toString();
  const today = new Date().toISOString().split("T")[0]; // "2026-09-12"
  const key = `ratelimit:ai:${userId}:${today}`;

  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, 86400); // 24 hours TTL, sirf pehli baar set karo
  }

  if (count > DAILY_LIMIT) {
    return failure(res, 429, `Daily AI request limit reached (${DAILY_LIMIT}/day). Try again tomorrow.`);
  }

  next();
}