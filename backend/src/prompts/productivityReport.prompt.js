// Prompt builder for the AI Weekly Summary / Productivity Report.
// Given a project + bucketed task lists, ask Gemini to produce a short human
// summary + highlights + concerns + suggested next steps as strict JSON.

function fmtTaskList(tasks, formatter) {
  if (!Array.isArray(tasks) || tasks.length === 0) return "  (none)";
  return tasks.map((t, i) => `  ${i + 1}. ${formatter(t)}`).join("\n");
}

function isoDate(d) {
  if (!d) return "no deadline";
  const parsed = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(parsed.getTime())) return "no deadline";
  return parsed.toISOString().slice(0, 10);
}

export function buildProductivityReportPrompt(
  projectTitle,
  completedTasks = [],
  pendingTasks = [],
  overdueTasks = []
) {
  const title = String(projectTitle || "").trim() || "(untitled project)";

  return `You are a project reporting assistant for coding students.

Analyze this project's recent activity and produce a weekly recap that helps the team see momentum, risks, and what to focus on next.

Project: "${title}"

Completed tasks (${completedTasks.length}):
${fmtTaskList(
  completedTasks,
  (t) =>
    `${t.title}${t.difficulty ? ` [${t.difficulty}]` : ""}${t.priority ? ` (${t.priority} priority)` : ""}`
)}

Pending tasks (${pendingTasks.length}):
${fmtTaskList(
  pendingTasks,
  (t) =>
    `${t.title}${t.priority ? ` [${t.priority} priority]` : ""}${
      t.deadline ? ` — due ${isoDate(t.deadline)}` : ""
    }`
)}

Overdue tasks (${overdueTasks.length}):
${fmtTaskList(
  overdueTasks,
  (t) => `${t.title} — was due ${isoDate(t.deadline)}`
)}

Respond with ONLY valid JSON matching this exact schema. No markdown code fences, no explanation text before or after — just the raw JSON object.

{
  "summary": "string (2-3 sentences, human-readable recap of the last week)",
  "highlights": ["string", "string"],
  "concerns": ["string"],
  "suggestedNextSteps": ["string", "string"]
}

Rules:
- "summary" is 2-3 sentences of plain English, focused on progress + momentum.
- "highlights" contains 2 to 5 specific wins (e.g. "Shipped authentication flow", "Completed 4 medium-difficulty tasks").
- "concerns" contains 0 to 4 specific risks (e.g. "3 tasks overdue", "No progress on backend for 2 days"). If there is truly nothing to flag, return an empty array [].
- "suggestedNextSteps" contains 2 to 5 concrete, actionable items for the coming week.
- Do NOT wrap the JSON in \`\`\`json fences.
- Do NOT include commentary before or after.
- Return ONLY the JSON object.`;
}
