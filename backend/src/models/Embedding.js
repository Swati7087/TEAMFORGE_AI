import mongoose from "mongoose";

const embeddingSchema = new mongoose.Schema(
  {
    sourceType: {
      type: String,
      enum: ["task", "meeting", "readme", "project", "contribution"],
      required: true,
    },
    // String so contribution keys like `${projectId}_${githubUsername}` work
    // alongside Task/Project ObjectIds (stored as hex strings).
    sourceId: {
      type: String,
      required: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    vector: {
      type: [Number],
      required: true,
    },
  },
  { timestamps: true }
);

embeddingSchema.index({ sourceType: 1, sourceId: 1 }, { unique: true });
embeddingSchema.index({ project: 1 });

const Embedding = mongoose.model("Embedding", embeddingSchema);
export default Embedding;
