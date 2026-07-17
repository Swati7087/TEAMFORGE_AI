// Prompt builder for AI Meeting Assistant.
// Turns raw pasted notes into structured summary + action items.

export function buildMeetingSummaryPrompt(rawNotes, teamMemberNames = []) {
  const notes = String(rawNotes || "").trim();
  const names = JSON.stringify(teamMemberNames, null, 2);

  return `You are a meeting-notes assistant for student project teams.

Turn these raw meeting notes into a structured summary. Attribute action items to real team members when possible.

Raw meeting notes:
"""
${notes}
"""

Valid team member names (use ONLY these for "assignedTo", or "Unassigned" if unclear):
${names}

Respond with ONLY valid JSON matching this exact schema. No markdown code fences, no extra text.

{
  "summary": "string (3-5 sentences)",
  "actionItems": [
    {
      "task": "string",
      "assignedTo": "string (a name from teamMemberNames, or 'Unassigned')",
      "priority": "low | medium | high"
    }
  ],
  "nextMeetingGoals": ["string"]
}

Rules:
- "summary" is 3-5 sentences covering key decisions, progress, and blockers.
- "actionItems" lists concrete follow-ups mentioned in the notes (2-8 items). Each "assignedTo" MUST be an exact name from the team list above, or "Unassigned".
- Do NOT invent team member names — only use names from the list or "Unassigned".
- "priority" reflects urgency implied in the notes (default "medium" if unclear).
- "nextMeetingGoals" has 2-5 items to cover in the next sync.
- Do NOT wrap the JSON in \`\`\`json fences.
- Return ONLY the JSON object.`;
}
