import Contribution from "../models/Contribution.js";
import Project from "../models/Project.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { success, failure } from "../utils/apiResponse.js";

// GET /api/contributions/:projectId — latest cached analysis, no re-run.
export const getLatestContribution = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const project = await Project.findById(projectId);
  if (!project) {
    return failure(res, 404, "Project not found");
  }

  const isOwner = project.owner.equals(req.user._id);
  const isMember = project.members.some((m) => m.equals(req.user._id));
  if (!isOwner && !isMember) {
    return failure(res, 403, "Not authorized to access this project");
  }

  const contribution = await Contribution.findOne({ project: projectId })
    .populate("contributors.user", "name email profilePicture githubProfile")
    .sort({ generatedAt: -1 });

  if (!contribution) {
    return failure(res, 404, "No contribution analysis found");
  }

  return success(res, 200, contribution);
});
