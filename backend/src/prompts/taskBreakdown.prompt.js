// Prompt builder for the AI Task Breakdown.
// Given a project's title/description/techStack, ask Gemini to produce 6-12
// concrete engineering tasks as a strict JSON array.

export function buildTaskBreakdownPrompt(projectTitle, projectDescription, techStack) {
  const title = String(projectTitle || "").trim();
  const description = String(projectDescription || "").trim() || "(no description provided)";
  const stackList = Array.isArray(techStack) && techStack.length
    ? techStack.join(", ")
    : "unspecified";

  return `You are a task planning assistant for coding students.

Break the following project into 6 to 12 concrete engineering tasks that together deliver the described product. Cover the whole lifecycle (setup, core features, integrations, polish, testing).

Project title: "${title}"
Project description: "${description}"
Tech stack: ${stackList}

Respond with ONLY a valid JSON array matching this exact schema. No markdown code fences, no explanation text before or after — just the raw JSON array.

[
  {
    "title": "string",
    "description": "string",
    "difficulty": "easy | medium | hard",
    "priority": "low | medium | high",
    "estimatedTime": "string (e.g. '3 days')",
    "suggestedRole": "string (e.g. 'backend', 'frontend', 'design')"
  }
]

Rules:
- Produce between 6 and 12 task objects.
- Every field is required on every task.
- "difficulty" must be exactly one of: easy, medium, hard.
- "priority" must be exactly one of: low, medium, high.
- "suggestedRole" should be a short lowercase label (e.g. "backend", "frontend", "design", "devops", "qa", "docs").
- "estimatedTime" is a short natural-language duration (e.g. "4 hours", "2 days", "1 week").
- Tasks should be ordered roughly by dependency / build order.
- Do NOT wrap the array in \`\`\`json fences.
- Do NOT include any commentary, preamble, or trailing notes.
- Return ONLY the JSON array.`;
}
