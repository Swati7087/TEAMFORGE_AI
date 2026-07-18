// Prompt builder for AI Deadline Predictor (Phase 6c).

export function buildDeadlinePredictorPrompt(projectTitle, deadline, metrics) {
  const title = String(projectTitle || "").trim() || "(untitled project)";
  const timeline = String(deadline || "").trim() || "(no deadline set)";
  const metricsJson = JSON.stringify(metrics, null, 2);

  return `You are a project timeline analyst for student coding teams.

Given a project deadline/timeline and pre-computed task metrics, estimate the probability of completing on time. Use the real numbers — do NOT fabricate statistics.

Project: "${title}"
Target timeline / deadline: "${timeline}"

Task metrics (pre-computed — use these exact numbers):
${metricsJson}

Respond with ONLY valid JSON matching this exact schema. No markdown code fences, no extra text.

{
  "completionProbability": number,
  "reasoning": "string",
  "riskFactors": ["string"],
  "recommendedActions": ["string"]
}

Rules:
- "completionProbability" is an integer 0–100 representing likelihood of finishing before the deadline.
- "reasoning" must cite real metrics (e.g. "3 of 8 tasks overdue", "2 unassigned tasks remaining", "avg completion ~4 days per task").
- Tone example: "Project has an 87% chance of completing before the deadline."
- "riskFactors" lists 0–5 specific risks grounded in the metrics.
- "recommendedActions" lists 2–5 concrete next steps.
- Do NOT wrap the JSON in \`\`\`json fences.
- Return ONLY the JSON object.`;
}
