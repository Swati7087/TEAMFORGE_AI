// Prompt builder for the AI Project Generator.
// Given a one-line idea, ask Gemini to return a project scaffold as strict JSON.

export function buildProjectGeneratorPrompt(ideaText) {
  const idea = String(ideaText || "").trim();

  return `You are a project planning assistant for coding students.

Given the following one-line project idea, generate a project scaffold.

Idea: "${idea}"

Respond with ONLY valid JSON matching this exact schema. No markdown code fences, no explanation text before or after the JSON — just the raw JSON object.

{
  "title": "string",
  "description": "string (2-3 sentences)",
  "techStack": ["string", "string"],
  "features": ["string", "string"],
  "estimatedDifficulty": "beginner | intermediate | advanced",
  "timeline": "string (e.g. '4 weeks')",
  "requiredRoles": ["string", "string"]
}

Rules:
- "techStack" must contain 3 to 6 technologies (e.g. "React", "Node.js", "MongoDB").
- "features" must contain 4 to 8 concise feature bullets.
- "requiredRoles" must contain 2 to 5 short role labels (e.g. "backend developer", "frontend developer", "designer").
- "estimatedDifficulty" must be exactly one of: beginner, intermediate, advanced.
- "timeline" should be a short natural-language duration (e.g. "3 weeks", "6 weeks", "2 months").
- Do NOT wrap the JSON in \`\`\`json fences.
- Do NOT include any commentary, preamble, or trailing notes.
- Return ONLY the JSON object.`;
}
