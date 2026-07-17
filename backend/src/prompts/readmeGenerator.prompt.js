// Prompt builder for AI README Generator.
// Output is raw Markdown (not JSON).

function fmtTasks(tasks, label) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return `(${label}: none listed)`;
  }
  return tasks
    .map(
      (t, i) =>
        `${i + 1}. ${t.title}${t.description ? ` — ${t.description}` : ""}${
          t.status ? ` [${t.status}]` : ""
        }`
    )
    .join("\n");
}

export function buildReadmePrompt(project, tasks = [], techStack = []) {
  const title = project?.title || "Untitled Project";
  const description = project?.description || "";
  const stack = Array.isArray(techStack) ? techStack : project?.techStack || [];
  const stackList = stack.length > 0 ? stack.join(", ") : "(not specified)";

  const completed = tasks.filter((t) => t.status === "done");
  const planned = tasks.filter((t) => t.status !== "done");

  return `You are a technical writer helping coding students produce a professional GitHub README.

Generate a complete README in Markdown for this student project. Use REAL project data below — do NOT use placeholder text like "Your Project Name" or "Lorem ipsum".

Project title: ${title}
Description: ${description || "(no description provided)"}
Tech stack: ${stackList}

Completed tasks:
${fmtTasks(completed, "completed")}

Planned / in-progress tasks:
${fmtTasks(planned, "planned")}

Output ONLY the README Markdown. No JSON, no code fences wrapping the whole document, no preamble or explanation.

Required sections (use these exact headings):

# ${title}

## Overview
(2-4 sentences using the real description and project purpose)

## Features
(Derive from completed + planned tasks — bullet list of real features/capabilities)

## Tech Stack
(List the actual technologies from the tech stack)

## Installation
(Reasonable setup steps for this stack — clone, install deps, env vars if relevant, run dev server)

## Folder Structure
(Generic but reasonable directory tree guess based on the tech stack — e.g. frontend/backend split for MERN)

## Contributing
(Short guidelines for team members: branch naming, PR flow, who to contact)

## Future Scope
(2-5 bullets based on planned tasks and natural extensions)

Rules:
- Write in clear, professional English suitable for a class portfolio repo.
- Use real task titles and tech names from the input — never generic filler.
- Installation and folder structure should match the stated tech stack (React, Node, MongoDB, etc.).
- Return ONLY the markdown README content.`;
}
