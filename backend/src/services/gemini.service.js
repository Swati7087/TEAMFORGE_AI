// All Gemini prompt calls live here.
// Controllers must NEVER call Gemini directly — always go through a service function.
//
// We deliberately do NOT validate the API key's shape/prefix. Older keys start
// with "AIza..."; newer keys start with "AQ....". Both are valid against the
// v1beta REST endpoint — Google is the source of truth on validity. Any local
// shape check would falsely reject new keys.

import axios from "axios";

// Model is configurable via env (GEMINI_MODEL) so we can swap without code
// changes. Default is gemini-flash-latest — a Google-maintained alias that
// tracks the current recommended flash model. Explicit models like
// gemini-2.0-flash are often provisioned with limit=0 on new/free accounts,
// so we prefer the alias.
const DEFAULT_MODEL = "gemini-flash-latest";

function getModel() {
  const raw = process.env.GEMINI_MODEL || "";
  return raw.trim() || DEFAULT_MODEL;
}

function getEndpoint() {
  return `https://generativelanguage.googleapis.com/v1beta/models/${getModel()}:generateContent`;
}

// Read the key at call time (not at import time), so nodemon restarts pick up
// .env edits. Trim defensively — dotenv 16+ trims already, but a stray space
// in the value would otherwise be URL-encoded into the request and rejected.
// This is whitespace cleanup, NOT shape validation.
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

// User-facing message for API failures — avoids burying quota/key issues
// behind a generic "please try again".
export function geminiUserMessage(err) {
  if (!err) return "AI generation failed, please try again";
  if (err.message?.includes("GEMINI_API_KEY is not set")) {
    return "AI is not configured — GEMINI_API_KEY is missing on the server.";
  }
  if (err.status === 429) {
    const raw = String(err.rawResponse || "");
    if (raw.includes("limit: 0")) {
      const model = getModel();
      return `This model has no free-tier quota on your account (${model}). Set GEMINI_MODEL=gemini-flash-lite-latest in backend/.env and restart the server.`;
    }
    if (raw.includes("PerDay") || raw.includes("per day")) {
      return "Gemini free daily quota used up (~20 requests/day). Wait until tomorrow, or set GEMINI_MODEL to a different model in backend/.env.";
    }
    return "Gemini rate limit reached — wait about 60 seconds, then try one feature at a time.";
  }
  if (err.status === 503 || String(err.rawResponse || "").includes("high demand")) {
    return "Gemini is busy right now — wait a minute and try again, or set GEMINI_MODEL=gemini-flash-lite-latest in backend/.env.";
  }
  if (err.status === 401 || err.status === 403) {
    return "Gemini API key is invalid or unauthorized — check GEMINI_API_KEY.";
  }
  return "AI generation failed, please try again";
}

export async function callGemini(promptText) {
  const key = getKey();
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  let res;
  try {
    res = await axios.post(
      `${getEndpoint()}?key=${encodeURIComponent(key)}`,
      { contents: [{ parts: [{ text: promptText }] }] },
      { timeout: 90000, headers: { "Content-Type": "application/json" } }
    );
  } catch (axiosErr) {
    // Fail fast on 429 — Google often says "retry in ~60s" which leaves the
    // UI spinning for minutes if we auto-retry. Tell the user immediately.
    throw buildGeminiError(axiosErr);
  }

  const text = res?.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string" || text.length === 0) {
    const err = new Error("Gemini returned an empty response");
    err.rawResponse = JSON.stringify(res?.data ?? null);
    throw err;
  }
  return text;
}

// Gemini sometimes wraps JSON in ```json ... ``` fences despite instructions.
// Strip a single leading/trailing fence pair defensively before parsing.
function stripMarkdownFences(raw) {
  let s = String(raw).trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json|JSON)?\s*\n?/, "");
    if (s.endsWith("```")) {
      s = s.slice(0, -3);
    }
    s = s.trim();
  }
  return s;
}

// callGeminiJSON:
//   - calls callGemini(promptText)
//   - strips markdown fences defensively
//   - JSON.parse
//   - on parse failure throws an Error whose .rawResponse holds the untouched
//     Gemini text, so the controller can persist it to AIHistory.rawResponse
//     for debugging.
//
// Returns { parsed, raw } so callers can log the raw response even on success.
export async function callGeminiJSON(promptText) {
  const raw = await callGemini(promptText);
  const cleaned = stripMarkdownFences(raw);

  try {
    const parsed = JSON.parse(cleaned);
    return { parsed, raw };
  } catch (parseErr) {
    const err = new Error(
      `Failed to parse Gemini JSON response: ${parseErr.message}`
    );
    err.rawResponse = raw;
    err.cleanedResponse = cleaned;
    throw err;
  }
}
