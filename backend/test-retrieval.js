import { connectDB } from "./src/config/db.js";
import mongoose from "mongoose";
import Embedding from "./src/models/Embedding.js";
import {
  retrieveRelevantContext,
  ensureVectorSearchIndex,
} from "./src/services/retrieval.service.js";

const QUERY = "What did the AI integration involve?";

async function pickProjectWithEmbeddings() {
  const rows = await Embedding.aggregate([
    {
      $group: {
        _id: "$project",
        count: { $sum: 1 },
        types: { $addToSet: "$sourceType" },
        sample: { $first: "$text" },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 5 },
  ]);

  if (!rows.length) {
    throw new Error("No embeddings found — run scripts/backfill-embeddings.js first");
  }

  const aiRelated = rows.find((r) =>
    String(r.sample || "").toLowerCase().includes("ai")
  );
  return aiRelated || rows[0];
}

try {
  await connectDB();

  console.log("mongo host:", mongoose.connection.host);
  const indexResult = await ensureVectorSearchIndex();
  console.log("vector_index:", indexResult);

  const project = await pickProjectWithEmbeddings();
  console.log("projectId:", String(project._id));
  console.log("embedding count:", project.count);
  console.log("sourceTypes:", project.types.join(", "));
  console.log("sample text:", String(project.sample).slice(0, 120));
  console.log("---");
  console.log("query:", QUERY);

  const results = await retrieveRelevantContext(QUERY, project._id, 5);
  console.log("hits after score >= 0.5:", results.length);

  results.forEach((hit, i) => {
    console.log(`\n#${i + 1}  type=${hit.sourceType}  score=${hit.score.toFixed(4)}`);
    console.log(String(hit.text).slice(0, 400));
  });

  if (results.length === 0) {
    console.log("\nNo results above the 0.5 threshold.");
  }

  await mongoose.disconnect();
  process.exit(0);
} catch (err) {
  console.error("Retrieval test failed:", err.message);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
}
