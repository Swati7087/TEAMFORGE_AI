import mongoose from "mongoose";

// One GitHub repo connection per project. The PAT is stored encrypted —
// see utils/encryption.js and the tokenIv field (AES-256-CBC needs the iv
// alongside the ciphertext to decrypt).
const repositorySchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      unique: true,
    },
    connectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    repoUrl: {
      type: String,
      required: true,
      trim: true,
    },
    owner: {
      type: String,
      required: true,
      trim: true,
    },
    repoName: {
      type: String,
      required: true,
      trim: true,
    },
    encryptedToken: {
      type: String,
      required: true,
    },
    tokenIv: {
      type: String,
      required: true,
    },
    lastSyncedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const Repository = mongoose.model("Repository", repositorySchema);
export default Repository;
