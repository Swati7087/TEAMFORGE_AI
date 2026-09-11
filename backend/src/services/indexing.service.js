import Embedding from "../models/Embedding.js";
import { generateEmbedding } from "./embedding.service.js";

// Best-effort content indexing. Failures are logged and swallowed so the
// calling request (create task, generate README, etc.) still succeeds.
export async function indexContent({ sourceType, sourceId, projectId, text }) {
  try {
    const cleaned = String(text ?? "").trim();
    if (!cleaned) {
      console.warn(
        `[indexing] skip empty text (${sourceType} ${sourceId})`
      );
      return;
    }
    if (!sourceType || !sourceId || !projectId) {
      console.warn("[indexing] skip missing sourceType/sourceId/projectId");
      return;
    }

    const vector = await generateEmbedding(cleaned);
    await Embedding.findOneAndUpdate(
      { sourceType, sourceId: String(sourceId) },
      {
        sourceType,
        sourceId: String(sourceId),
        project: projectId,
        text: cleaned,
        vector,
        updatedAt: new Date(),
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
  } catch (err) {
    console.error(
      `[indexing] failed for ${sourceType} ${sourceId}:`,
      err.message
    );
    if (err.rawResponse) {
      console.error(
        "[indexing] Gemini raw:",
        String(err.rawResponse).slice(0, 300)
      );
    }
  }
}
