// Prompt builder for Sprint Planner (Phase 7 / merged 6d).

export function buildSprintPlannerPrompt(tasks, teamSize, timelineWeeks) {
  const taskList = (tasks || []).map((t) => ({
    id: String(t._id || t.id),
    title: t.title,
    status: t.status,
    priority: t.priority,
    difficulty: t.difficulty,
    deadline: t.deadline || null,
  }));

  const tasksJson = JSON.stringify(taskList, null, 2);
  const weeks = Math.max(1, Math.min(12, Number(timelineWeeks) || 4));
  const size = Math.max(1, Number(teamSize) || 1);

  return `You are an agile sprint planner for student coding teams.

Plan ${weeks} weekly sprints for a team of ${size} people. Assign incomplete tasks (status "todo" or "in-progress") to sprints by priority, difficulty, and deadlines. Already-done tasks may be omitted.

Tasks:
${tasksJson}

Respond with ONLY valid JSON matching this exact schema. No markdown code fences, no extra text.

{
  "sprints": [
    {
      "week": number,
      "focus": "string",
      "taskIds": ["string"]
    }
  ]
}

Rules:
- week: integer from 1 to ${weeks} inclusive.
- focus: short theme for that sprint (e.g. "Auth & user setup").
- taskIds: exact "id" values from the task list — only assign each task once across all sprints.
- Balance workload across weeks given team size ${size}.
- Higher priority and sooner deadlines should land in earlier sprints.
- If there are no incomplete tasks, return one sprint with week 1, focus describing the empty board, taskIds: [].
- Do NOT wrap the JSON in \`\`\`json fences.
- Return ONLY the JSON object.`;
}
