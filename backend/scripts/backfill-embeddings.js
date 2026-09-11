import { connectDB } from "../src/config/db.js";
import mongoose from "mongoose";
import Project from "../src/models/Project.js";
import Task from "../src/models/Task.js";
import Contribution from "../src/models/Contribution.js";
import { indexContent } from "../src/services/indexing.service.js";

function projectText(project) {
  return `${project.title || ""}. ${project.description || ""}`.trim();
}

function taskText(task) {
  return `${task.title || ""}. ${task.description || ""}`.trim();
}

async function run() {
  if (!process.env.GEMINI_API_KEY?.trim()) {
    console.error("GEMINI_API_KEY is not set — cannot backfill embeddings");
    process.exit(1);
  }

  await connectDB();

  const projects = await Project.find().select("title description").lean();
  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];
    await indexContent({
      sourceType: "project",
      sourceId: project._id,
      projectId: project._id,
      text: projectText(project),
    });
    console.log(`Indexed ${i + 1}/${projects.length} projects`);
  }

  const tasks = await Task.find().select("title description project").lean();
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    await indexContent({
      sourceType: "task",
      sourceId: task._id,
      projectId: task.project,
      text: taskText(task),
    });
    console.log(`Indexed ${i + 1}/${tasks.length} tasks`);
  }

  const contributions = await Contribution.find()
    .select("project contributors")
    .lean();
  let contributionCount = 0;
  let contributionTotal = contributions.reduce(
    (sum, doc) => sum + (doc.contributors?.length || 0),
    0
  );
  for (const doc of contributions) {
    for (const contributor of doc.contributors || []) {
      contributionCount += 1;
      const username = contributor.githubUsername || "unknown";
      await indexContent({
        sourceType: "contribution",
        sourceId: `${doc.project}_${username}`,
        projectId: doc.project,
        text: `${username}: ${contributor.summary || ""}`,
      });
      console.log(
        `Indexed ${contributionCount}/${contributionTotal} contributions`
      );
    }
  }

  if (contributionTotal === 0) {
    console.log("Indexed 0/0 contributions");
  }

  console.log("Backfill complete");
  console.log(`  projects: ${projects.length}`);
  console.log(`  tasks: ${tasks.length}`);
  console.log(`  contributions: ${contributionTotal}`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error("Backfill failed:", err.message);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
