import User from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { success, failure } from "../utils/apiResponse.js";

// GET /api/users
// Minimal fields for the invite dialog + AI Team Matcher.
export const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find(
    {},
    "name email skills experienceLevel availability profilePicture"
  );
  return success(res, 200, { users }, "Users list");
});

// GET /api/users/:id
export const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return failure(res, 404, "User not found");
  }
  return success(res, 200, { user }, "User profile");
});

// PUT /api/users/:id
// Own-profile-only. Silently ignores any non-allowlisted fields.
export const updateUser = asyncHandler(async (req, res) => {
  if (req.user._id.toString() !== req.params.id) {
    return failure(res, 403, "You can only update your own profile");
  }

  const allowed = [
    "bio",
    "skills",
    "experienceLevel",
    "availability",
    "githubProfile",
    "linkedinProfile",
    "profilePicture",
  ];

  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  // runValidators: true is critical — without it, enum checks are skipped on update.
  const user = await User.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });

  if (!user) {
    return failure(res, 404, "User not found");
  }

  return success(res, 200, { user }, "Profile updated");
});
