import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },

    // Not required: users who sign up via Google never set a password.
    password: { type: String, required: false, select: false },

    authProvider: { type: String, enum: ["local", "google"], default: "local" },
    googleId: { type: String, default: null },

    profilePicture: { type: String, default: null },
    bio: { type: String, default: "" },
    skills: [{ type: String }],
    experienceLevel: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "beginner",
    },
    availability: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    githubProfile: { type: String, default: "" },
    linkedinProfile: { type: String, default: "" },

    projects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Project" }],
  },
  { timestamps: true }
);

// Hash password only if it was set/changed, and only exists for local auth users.
// Note: Mongoose 9 async pre-hooks don't receive `next` — just return / throw.
userSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = async function (candidate) {
  if (!this.password) return false; // Google-only user has no password to compare
  return bcrypt.compare(candidate, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;
