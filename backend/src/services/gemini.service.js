// All Gemini prompt calls live here.
// Controllers must never call Gemini directly — always go through a service function.

import axios from "axios";

export async function callGemini(promptText) {
  const res = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    { contents: [{ parts: [{ text: promptText }] }] }
  );
  return res.data.candidates[0].content.parts[0].text;
}
