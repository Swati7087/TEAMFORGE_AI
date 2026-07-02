import mongoose from "mongoose";

// A Project is owned by exactly one user and can accept many members via the
// Team invite/request flow (see Team.js). `members` is the finalised roster —
// only users who accepted an invite or had their join request approved land
// here. The owner is stored separately and is NOT duplicated into `members`.
const projectSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    tasks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task",
      },
    ],
    // GitHub repo URL — populated in Phase 5.
    repository: {
      type: String,
      trim: true,
      default: "",
    },
    techStack: [
      {
        type: String,
        trim: true,
      },
    ],
    timeline: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["planning", "in-progress", "completed"],
      default: "planning",
    },
  },
  { timestamps: true }
);

const Project = mongoose.model("Project", projectSchema);
export default Project;
