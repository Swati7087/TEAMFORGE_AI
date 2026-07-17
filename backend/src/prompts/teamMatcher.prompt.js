// Prompt builder for AI Team Matcher.
// Ranks candidates against project needs + explicit team skill gaps.

export function buildTeamMatcherPrompt(
  projectRequirements,
  candidateUsers = [],
  skillCoverage = {}
) {
  const { alreadyCovered = [], missingSkills = [] } = skillCoverage;

  const requirements = JSON.stringify(projectRequirements, null, 2);
  const covered = JSON.stringify(alreadyCovered, null, 2);
  const missing = JSON.stringify(missingSkills, null, 2);
  const candidates = JSON.stringify(candidateUsers, null, 2);

  return `You are a team-formation assistant for coding students building class projects.

Given a project's requirements, what the team ALREADY covers, what's MISSING, and a pool of candidate students NOT on the team — rank the best fits and explain why each would help.

Project requirements (title, description, tech stack, current members):
${requirements}

Skills the team ALREADY covers (do NOT prioritize candidates who only duplicate these):
${covered}

Skills the team is MISSING relative to the project (PRIORITIZE candidates who fill these gaps):
${missing}

Candidate users (NOT on the project yet):
${candidates}

CRITICAL SCORING RULE:
Prioritize candidates whose skills fill the team's current gaps. A candidate who duplicates skills the team already has should score LOWER than one who complements what's missing — even if their raw tech stack overlap with the project is smaller.

Example (follow this logic):
- Team already covers: ["React", "Node.js", "MongoDB"]
- Team is missing: ["Docker", "DevOps", "CI/CD"]
- Candidate A skills: ["React", "Node.js", "Express"] → matchScore ~40 (duplicates existing stack, doesn't fill gaps)
- Candidate B skills: ["Docker", "DevOps", "CI/CD"] → matchScore ~90 (fills critical missing deployment skills)
Candidate B MUST rank higher than Candidate A.

Respond with ONLY a valid JSON array matching this schema. No markdown code fences, no extra text.

[
  {
    "userId": "string (must match a candidate userId exactly)",
    "matchScore": number,
    "reason": "string"
  }
]

Rules:
- Return the top 5 matches only (or fewer if fewer than 5 candidates exist).
- "matchScore" is 0-100 — gap-fillers score higher, duplicate-skill candidates score lower.
- "reason" is 1-2 sentences explaining which MISSING skills this person fills (not just "knows React").
- Penalize candidates whose skills mostly overlap alreadyCovered.
- Reward candidates whose skills appear in missingSkills or clearly address project gaps.
- Factor in experienceLevel and availability only when gap-fit is similar.
- Only include userIds from the candidate list — do not invent users.
- Do NOT wrap the JSON in \`\`\`json fences.
- Return ONLY the JSON array.`;
}
