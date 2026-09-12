import { redis } from "./src/services/redis.service.js";

if (!redis) {
  console.log("Redis not configured");
  process.exit(1);
}

await redis.set("test-key", "hello");
const val = await redis.get("test-key");
console.log("Result:", val);