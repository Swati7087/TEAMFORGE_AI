import { Redis } from "@upstash/redis";
import { env } from "../config/env.js";

export const redis = env.upstashUrl && env.upstashToken
  ? new Redis({ url: env.upstashUrl, token: env.upstashToken })
  : null;