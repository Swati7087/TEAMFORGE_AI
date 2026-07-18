import mongoose from "mongoose";

// Every AI call is logged here — audit trail + a foothold for caching
// (avoiding re-calling Gemini for repeat views of the same generated output).
//
// `project` is optional: project-generation calls happen BEFORE a Project
// document exists, so they log with project=null. Task-breakdown and later
// AI features run against an existing project and store the link.
const AI_TYPES = [
  "project-generation",
  "task-breakdown",
  "team-match",
  "meeting-summary",
  "readme",
  "skill-gap",
  "productivity-report",
  "bottleneck",
  "deadline-predict",
  "conflict-resolver",
  "risk-analysis",
  "contribution-analysis",
];

const aiHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Nullable — project-generation runs before any project exists.
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
    type: {
      type: String,
      enum: AI_TYPES,
      required: true,
    },
    // The raw user-supplied input (idea string, or {projectId, title, techStack}, etc).
    // Deliberately NOT the full assembled prompt — we can rebuild that from input + type.
    input: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Parsed JSON result. null on failure.
    output: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Gemini's raw text response, kept so we can debug bad-JSON parses.
    rawResponse: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["success", "failed"],
      required: true,
    },
    errorMessage: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

const AIHistory = mongoose.model("AIHistory", aiHistorySchema);
export default AIHistory;
