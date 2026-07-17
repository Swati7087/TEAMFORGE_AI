// Prompt builder for AI Skill Gap Detector.
// Compares project needs vs the current team's collective skills.

export function buildSkillGapPrompt(projectRequirements, teamSkills = []) {
  const requirements = JSON.stringify(projectRequirements, null, 2);
  const skills = JSON.stringify(teamSkills, null, 2);

  return `You are a skills advisor for student project teams.

Compare what this project needs against what the current team collectively knows. Identify gaps and give practical recommendations.

Project requirements:
${requirements}

Current team skills (flattened from all members):
${skills}

Respond with ONLY valid JSON matching this exact schema. No markdown code fences, no extra text.

{
  "missingSkills": ["string"],
  "coveredSkills": ["string"],
  "recommendations": [
    {
      "skill": "string",
      "suggestion": "string"
    }
  ]
}

Rules:
- "missingSkills" lists skills/areas the project needs but the team lacks or is weak in (based on techStack, description, and typical project needs).
- "coveredSkills" lists skills the team already has covered well.
- "recommendations" has 2-5 actionable items — e.g. "Consider adding a member with DevOps experience, or explore free CI/CD tutorials".
- Be specific to this project's tech stack and description.
- Do NOT wrap the JSON in \`\`\`json fences.
- Return ONLY the JSON object.`;
}
