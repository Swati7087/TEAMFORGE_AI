import mongoose from "mongoose";

// Cached AI contribution analysis per project. Expensive to regenerate
// (GitHub API + Gemini), so we upsert one doc per project and let users
// manually re-analyze. AIHistory keeps the audit trail of past runs.
const contributorEntrySchema = new mongoose.Schema(
  {
    githubUsername: { type: String, required: true, trim: true },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    commitCount: { type: Number, default: 0 },
    linesAdded: { type: Number, default: 0 },
    linesDeleted: { type: Number, default: 0 },
    areas: [{ type: String, trim: true }],
    summary: { type: String, default: "" },
    contributionPercentage: { type: Number, default: 0 },
  },
  { _id: false }
);

const contributionSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      unique: true,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
    contributors: [contributorEntrySchema],
    rawStats: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

const Contribution = mongoose.model("Contribution", contributionSchema);
export default Contribution;
