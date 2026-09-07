// Prompt builder for Duplicate Work Detector (Phase 7 / merged 6d).

export function buildDuplicateWorkPrompt(tasks) {
  const taskList = (tasks || []).map((t) => ({
    id: String(t._id || t.id),
    title: t.title,
    description: t.description || "",
    status: t.status,
  }));

  const tasksJson = JSON.stringify(taskList, null, 2);

  return `You are a project efficiency analyst for student coding teams.

Compare the following tasks and identify pairs or groups that overlap significantly in scope — work that two people might duplicate unknowingly.

Tasks:
${tasksJson}

Respond with ONLY valid JSON matching this exact schema. No markdown code fences, no extra text.

{
  "duplicates": [
    {
      "taskIds": ["string", "string"],
      "reason": "string"
    }
  ]
}

Rules:
- Only flag genuine overlap (same feature, same module, redundant work). Different phases of the same feature (e.g. "design auth" vs "implement auth") are NOT duplicates unless scope truly overlaps.
- taskIds must be exact "id" values from the task list above.
- Each duplicates entry needs at least 2 taskIds.
- reason: one sentence explaining why these tasks overlap.
- If no meaningful duplicates exist, return duplicates: [].
- Do NOT wrap the JSON in \`\`\`json fences.
- Return ONLY the JSON object.`;
}
