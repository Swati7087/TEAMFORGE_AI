// Prompt builder for AI Bottleneck Detector (Phase 6c).

export function buildBottleneckPrompt(projectTitle, metrics) {
  const title = String(projectTitle || "").trim() || "(untitled project)";
  const metricsJson = JSON.stringify(metrics, null, 2);

  return `You are a project health analyst for student coding teams.

Analyze pre-computed task metrics and identify real bottlenecks. Reference specific numbers and task titles from the metrics — do NOT invent tasks or statistics.

Project: "${title}"

Task metrics (pre-computed — use these exact numbers):
${metricsJson}

Respond with ONLY valid JSON matching this exact schema. No markdown code fences, no extra text.

{
  "bottlenecks": [
    {
      "type": "delayed-module | overloaded-member | unassigned-cluster",
      "description": "string",
      "severity": "low | medium | high",
      "affectedTasks": ["string (task titles from metrics)"]
    }
  ],
  "summary": "string"
}

Rules:
- "type" must be exactly one of: delayed-module, overloaded-member, unassigned-cluster.
- Base every bottleneck on the metrics — e.g. overdueTaskTitles, unassignedTaskTitles, staleInProgress, tasksByAssignee overload patterns.
- Tone example: "Backend development is delayed because authentication APIs are unfinished."
- If overdueTasks > 0, you MUST mention overdue work in at least one bottleneck.
- If unassignedTasks > 0, include an unassigned-cluster bottleneck.
- severity: high = blocking delivery, medium = slowing progress, low = minor concern.
- If metrics show no real issues, return bottlenecks: [] with a positive summary.
- Do NOT wrap the JSON in \`\`\`json fences.
- Return ONLY the JSON object.`;
}
