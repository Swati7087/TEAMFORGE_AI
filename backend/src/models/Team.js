import mongoose from "mongoose";

// A single membership entry inside a Team. Every invite or join-request the
// project sees becomes an entry here, with `status` tracking its lifecycle.
const teamMemberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["invited", "requested", "accepted", "rejected"],
      required: true,
    },
    role: {
      type: String,
      trim: true,
      default: "",
    },
    // The owner who sent an invite. Null when the entry originated from the
    // user self-requesting to join.
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

// One Team per Project. Created lazily on the first invite/request so brand-
// new projects don't carry an empty Team document around.
const teamSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      unique: true,
    },
    members: [teamMemberSchema],
  },
  { timestamps: true }
);

const Team = mongoose.model("Team", teamSchema);
export default Team;
