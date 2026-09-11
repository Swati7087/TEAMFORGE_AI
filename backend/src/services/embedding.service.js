// Gemini embedding calls live here.
// Controllers must NEVER call Gemini directly — always go through a service function.

import axios from "axios";

// text-embedding-004 is not listed on current API keys (404 on v1beta).
// gemini-embedding-001 supports embedContent; request 768 dims to match
// the Embedding.vector contract used by later RAG phases.
const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIM = 768;

function getEndpoint() {
  return `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`;
}

// Read the key at call time (not at import time), so nodemon restarts pick up
// .env edits. Trim defensively — a stray space would be URL-encoded and rejected.
function getKey() {
  const raw = process.env.GEMINI_API_KEY || "";
  return raw.trim();
}

function buildGeminiError(axiosErr) {
  const status = axiosErr?.response?.status;
  const body = axiosErr?.response?.data;
  const bodyText =
    typeof body === "string" ? body : JSON.stringify(body ?? null);
  const err = new Error(
    status
      ? `Gemini API error ${status}: ${bodyText?.slice(0, 300) || axiosErr.message}`
      : `Gemini API network error: ${axiosErr.message}`
  );
  err.rawResponse = bodyText || "";
  err.status = status || null;
  return err;
}

export async function generateEmbedding(text) {
  const key = getKey();
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const inputText = String(text ?? "").trim();
  if (!inputText) {
    throw new Error("generateEmbedding requires non-empty text");
  }

  let res;
  try {
    res = await axios.post(
      `${getEndpoint()}?key=${encodeURIComponent(key)}`,
      {
        content: { parts: [{ text: inputText }] },
        outputDimensionality: EMBEDDING_DIM,
      },
      { timeout: 90000, headers: { "Content-Type": "application/json" } }
    );
  } catch (axiosErr) {
    throw buildGeminiError(axiosErr);
  }

  const values = res?.data?.embedding?.values;
  if (!Array.isArray(values) || values.length === 0) {
    const err = new Error("Gemini returned an empty embedding");
    err.rawResponse = JSON.stringify(res?.data ?? null);
    throw err;
  }

  if (values.length !== EMBEDDING_DIM) {
    const err = new Error(
      `Gemini embedding dimension mismatch: expected ${EMBEDDING_DIM}, got ${values.length}`
    );
    err.rawResponse = JSON.stringify({ length: values.length });
    throw err;
  }

  return values;
}
