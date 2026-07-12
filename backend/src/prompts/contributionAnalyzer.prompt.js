// Prompt builder for AI Contribution Analysis.
// Takes compact per-contributor summaries (messages + file paths, not diffs)
// and asks Gemini to categorize work areas + write a short summary per person.

const ALLOWED_AREAS = [
  "frontend",
  "backend",
  "database",
  "testing",
  "docs",
  "deployment",
  "AI-integration",
  "devops",
  "design",
  "other",
];

export function buildContributionAnalyzerPrompt(contributorsRawData = []) {
  const payload = JSON.stringify(contributorsRawData, null, 2);

  return `You are a technical project analyst helping coding students understand who worked on what in a team repository.

Below is structured data per GitHub contributor: commit count, lines added/deleted, recent commit messages, and file paths touched. Use the file paths and messages to infer what each person actually worked on — not just how many commits they made.

Contributors data:
${payload}

Allowed area values (pick 1-4 per person from this list only):
${ALLOWED_AREAS.map((a) => `- ${a}`).join("\n")}

Respond with ONLY a valid JSON array matching this schema. No markdown code fences, no explanation text — just the raw JSON array.

[
  {
    "githubUsername": "string (must match an input githubUsername exactly)",
    "areas": ["string"],
    "summary": "string (1-2 sentences, natural language, what this person mainly contributed)"
  }
]

Rules:
- Return one entry per contributor in the input data.
- "areas" must only use values from the allowed list above.
- Base areas on file paths (e.g. frontend/src → frontend, backend/src → backend, *.test.* → testing, README/docs → docs, prompts/ or gemini → AI-integration).
- "summary" is 1-2 plain-English sentences a student teammate would understand.
- Do NOT wrap the JSON in \`\`\`json fences.
- Return ONLY the JSON array.`;
}
