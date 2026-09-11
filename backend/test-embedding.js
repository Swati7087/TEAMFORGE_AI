import "dotenv/config";
import { generateEmbedding } from "./src/services/embedding.service.js";

const SAMPLE = "test project about AI task management";

try {
  const vector = await generateEmbedding(SAMPLE);
  console.log("embedding length:", vector.length);
  console.log("first 8 values:", vector.slice(0, 8));
  if (vector.length === 768) {
    console.log("OK: 768-dimension embedding");
    process.exit(0);
  }
  console.error(`FAIL: expected length 768, got ${vector.length}`);
  process.exit(1);
} catch (err) {
  console.error("Embedding test failed:", err.message);
  if (err.status) console.error("status:", err.status);
  if (err.rawResponse) console.error("raw:", String(err.rawResponse).slice(0, 500));
  process.exit(1);
}
