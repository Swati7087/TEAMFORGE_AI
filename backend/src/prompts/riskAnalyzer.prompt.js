// Prompt builder for AI Risk Analyzer (Phase 6c).

export function buildRiskAnalyzerPrompt(projectTitle, techStack, metrics) {
  const title = String(projectTitle || "").trim() || "(untitled project)";
  const stack =
    Array.isArray(techStack) && techStack.length > 0
      ? techStack.join(", ")
      : "(none specified)";
  const metricsJson = JSON.stringify(metrics, null, 2);

  return `You are a project risk analyst for student coding teams.

Identify risks across technical, team, and timeline dimensions using the tech stack and pre-computed task metrics. Be specific to this project — do NOT use generic filler.

Project: "${title}"
Tech stack: ${stack}

Task metrics (pre-computed — use these exact numbers):
${metricsJson}

Respond with ONLY valid JSON matching this exact schema. No markdown code fences, no extra text.

{
  "risks": [
    {
      "category": "technical | team | timeline",
      "description": "string",
      "severity": "low | medium | high",
      "mitigation": "string"
    }
  ]
}

Rules:
- "category" must be exactly one of: technical, team, timeline.
- Include 2–6 risks when metrics show meaningful data; fewer if the project is healthy.
- Technical risks should relate to the actual tech stack (e.g. "Payment Integration has high implementation risk").
- Team risks should reference assignee load, unassigned tasks, or stale in-progress work from metrics.
- Timeline risks should reference overdue tasks, completion rate, or avgCompletionDays.
- Each "mitigation" is a concrete actionable step.
- Do NOT wrap the JSON in \`\`\`json fences.
- Return ONLY the JSON object.`;
}
