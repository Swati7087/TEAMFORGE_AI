import mongoose from "mongoose";
import Embedding from "../models/Embedding.js";
import { generateEmbedding } from "./embedding.service.js";
import vectorIndexDefinition from "../config/vector-index.json" with { type: "json" };

const VECTOR_INDEX = "vector_index";
const MIN_SCORE = 0.5;

function toObjectId(projectId) {
  if (projectId instanceof mongoose.Types.ObjectId) return projectId;
  return new mongoose.Types.ObjectId(String(projectId));
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function mapHit(doc) {
  return {
    text: doc.text,
    sourceType: doc.sourceType,
    sourceId: doc.sourceId,
    score: doc.score,
  };
}

export async function ensureVectorSearchIndex() {
  const host = mongoose.connection.host || "";
  if (host === "localhost" || host === "127.0.0.1") {
    return {
      created: false,
      skipped: true,
      reason: "local mongod has no Atlas Search — use mongodb+srv MONGO_URI",
    };
  }

  const collection = mongoose.connection.collection("embeddings");
  try {
    await collection.createSearchIndex({
      name: VECTOR_INDEX,
      type: "vectorSearch",
      definition: vectorIndexDefinition,
    });
    return { created: true };
  } catch (err) {
    const msg = String(err.message || "");
    if (msg.includes("already exists") || err.code === 68) {
      return { created: false, existed: true };
    }
    return { created: false, error: msg };
  }
}

async function vectorSearch(queryVector, projectId, topK) {
  return Embedding.aggregate([
    {
      $vectorSearch: {
        index: VECTOR_INDEX,
        path: "vector",
        queryVector,
        numCandidates: 100,
        limit: topK,
        filter: { project: projectId },
      },
    },
    {
      $project: {
        text: 1,
        sourceType: 1,
        sourceId: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ]);
}

async function cosineSearch(queryVector, projectId, topK) {
  const docs = await Embedding.find({ project: projectId })
    .select("text sourceType sourceId vector")
    .lean();

  return docs
    .map((doc) => ({
      text: doc.text,
      sourceType: doc.sourceType,
      sourceId: doc.sourceId,
      score: cosineSimilarity(queryVector, doc.vector),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export async function retrieveRelevantContext(query, projectId, topK = 5) {
  const queryVector = await generateEmbedding(query);
  const project = toObjectId(projectId);

  let hits;
  try {
    hits = await vectorSearch(queryVector, project, topK);
  } catch (err) {
    const msg = String(err.message || "");
    if (msg.toLowerCase().includes("filter field not indexed")) {
      throw new Error(
        'Vector Search filter field "project" is not indexed. Update the vector_index definition to include { type: "filter", path: "project" }.'
      );
    }
    // Local mongod (no Atlas Search / mongot) — same project filter + cosine.
    console.warn(
      "[retrieval] $vectorSearch unavailable, using in-memory cosine:",
      msg.slice(0, 200)
    );
    hits = await cosineSearch(queryVector, project, topK);
  }

  const relevant = hits
    .map(mapHit)
    .filter((hit) => typeof hit.score === "number" && hit.score >= MIN_SCORE);

  return relevant;
}
