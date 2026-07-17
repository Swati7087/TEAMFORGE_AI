import mongoose from "mongoose";

const actionItemSchema = new mongoose.Schema(
  {
    task: { type: String, required: true, trim: true },
    assignedTo: { type: String, trim: true, default: "Unassigned" },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
  },
  { _id: false }
);

const meetingSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    rawNotes: {
      type: String,
      required: true,
      trim: true,
    },
    summary: {
      type: String,
      trim: true,
      default: "",
    },
    actionItems: {
      type: [actionItemSchema],
      default: [],
    },
    nextMeetingGoals: {
      type: [String],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

const Meeting = mongoose.model("Meeting", meetingSchema);
export default Meeting;
