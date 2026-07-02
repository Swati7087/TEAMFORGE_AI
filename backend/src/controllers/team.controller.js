import Project from "../models/Project.js";
import Team from "../models/Team.js";
import User from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { success, failure } from "../utils/apiResponse.js";
import { saveAtomically } from "../utils/atomicWrite.js";

// A Team document is created lazily so brand-new projects don't ship with an
// empty Team hanging off them.
async function getOrCreateTeam(projectId) {
  let team = await Team.findOne({ project: projectId });
  if (!team) team = await Team.create({ project: projectId, members: [] });
  return team;
}

// POST /api/teams/:projectId/invite { userId, role? }
// Only the project owner can send invites.
export const inviteToTeam = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { userId, role } = req.body;

  if (!userId) return failure(res, 400, "userId is required");

  const project = await Project.findById(projectId);
  if (!project) return failure(res, 404, "Project not found");

  if (!project.owner.equals(req.user._id)) {
    return failure(res, 403, "Only the project owner can invite members");
  }

  const invitee = await User.findById(userId);
  if (!invitee) return failure(res, 404, "User to invite not found");

  if (invitee._id.equals(req.user._id)) {
    return failure(res, 400, "You cannot invite yourself");
  }

  if (project.members.some((m) => m.equals(invitee._id))) {
    return failure(res, 400, "User is already a member");
  }

  const team = await getOrCreateTeam(projectId);
  const existing = team.members.find((m) => m.user.equals(invitee._id));

  if (existing) {
    if (existing.status === "invited") {
      return failure(res, 400, "User already invited");
    }
    if (existing.status === "accepted") {
      return failure(res, 400, "User is already a member");
    }
    if (existing.status === "requested") {
      // Owner inviting someone who already asked — treat as an accept.
      // Both mutations MUST be idempotent because a transaction retry (or
      // the fallback path) may run the writes twice on the same in-memory
      // doc: assignments are safe, and the `some(...)` guard turns the
      // push into an add-if-missing.
      existing.status = "accepted";
      existing.respondedAt = new Date();
      if (role) existing.role = role;
      if (!project.members.some((m) => m.equals(invitee._id))) {
        project.members.push(invitee._id);
      }
      await saveAtomically(async (session) => {
        await project.save({ session });
        await team.save({ session });
      });
      return success(res, 200, team, "Existing join request accepted");
    }
    if (existing.status === "rejected") {
      existing.status = "invited";
      existing.invitedBy = req.user._id;
      existing.respondedAt = null;
      existing.role = role || "";
      await team.save();
      return success(res, 200, team, "User re-invited");
    }
  }

  team.members.push({
    user: invitee._id,
    status: "invited",
    invitedBy: req.user._id,
    role: role || "",
  });
  await team.save();

  return success(res, 200, team, "User invited");
});

// POST /api/teams/:projectId/request
// Any logged-in non-owner, non-member can request to join.
export const requestToJoin = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const project = await Project.findById(projectId);
  if (!project) return failure(res, 404, "Project not found");

  if (project.owner.equals(req.user._id)) {
    return failure(res, 400, "You already own this project");
  }
  if (project.members.some((m) => m.equals(req.user._id))) {
    return failure(res, 400, "You are already a member");
  }

  const team = await getOrCreateTeam(projectId);
  const existing = team.members.find((m) => m.user.equals(req.user._id));

  if (existing) {
    if (existing.status === "requested") {
      return failure(res, 400, "You have already requested to join");
    }
    if (existing.status === "invited") {
      return failure(res, 400, "You have a pending invitation to accept");
    }
    if (existing.status === "accepted") {
      return failure(res, 400, "You are already a member");
    }
    if (existing.status === "rejected") {
      existing.status = "requested";
      existing.respondedAt = null;
      existing.invitedBy = null;
      await team.save();
      return success(res, 200, team, "Join request submitted");
    }
  }

  team.members.push({
    user: req.user._id,
    status: "requested",
    invitedBy: null,
  });
  await team.save();

  return success(res, 200, team, "Join request submitted");
});

// PATCH /api/teams/:projectId/respond { userId, status }
// - Invited user accepts/rejects their own invite → userId must equal req.user._id
// - Owner accepts/rejects a join request → project.owner must equal req.user._id
// On accept: Team entry flips to "accepted" AND Project.members gains the user
// (both writes happen together).
export const respondToInvite = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { userId, status } = req.body;

  if (!userId || !status) {
    return failure(res, 400, "userId and status are required");
  }
  if (!["accepted", "rejected"].includes(status)) {
    return failure(res, 400, "status must be 'accepted' or 'rejected'");
  }

  const project = await Project.findById(projectId);
  if (!project) return failure(res, 404, "Project not found");

  const team = await Team.findOne({ project: projectId });
  if (!team) return failure(res, 404, "No team exists for this project");

  const entry = team.members.find((m) => m.user.equals(userId));
  if (!entry) return failure(res, 404, "No pending invite/request for that user");

  const respondingAsInvitee = req.user._id.equals(userId);
  const respondingAsOwner = project.owner.equals(req.user._id);

  if (entry.status === "invited" && !respondingAsInvitee) {
    return failure(res, 403, "Only the invited user can respond to this invite");
  }
  if (entry.status === "requested" && !respondingAsOwner) {
    return failure(res, 403, "Only the project owner can respond to this request");
  }
  if (entry.status === "accepted") {
    return failure(res, 400, "User is already a member");
  }
  if (entry.status === "rejected") {
    return failure(res, 400, "This invite/request was already rejected");
  }

  entry.status = status;
  entry.respondedAt = new Date();

  // Compute the roster mutation once, guarded so a transaction retry (or
  // the sequential fallback path) can't double-add the same user.
  const shouldAddToRoster =
    status === "accepted" && !project.members.some((m) => m.equals(userId));
  if (shouldAddToRoster) project.members.push(userId);

  await saveAtomically(async (session) => {
    if (shouldAddToRoster) await project.save({ session });
    await team.save({ session });
  });

  return success(res, 200, team, `Invite/request ${status}`);
});

// GET /api/teams/:projectId — owner or member only.
export const getTeamForProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const project = await Project.findById(projectId);
  if (!project) return failure(res, 404, "Project not found");

  const isOwner = project.owner.equals(req.user._id);
  const isMember = project.members.some((m) => m.equals(req.user._id));
  if (!isOwner && !isMember) return failure(res, 403, "Not authorized");

  const team = await Team.findOne({ project: projectId })
    .populate("members.user", "name email profilePicture")
    .populate("members.invitedBy", "name email");

  return success(res, 200, team || { project: projectId, members: [] });
});

// DELETE /api/teams/:projectId/members/:userId — owner only. Owner cannot
// remove themselves this way (that's a project delete, not a membership op).
export const removeMember = asyncHandler(async (req, res) => {
  const { projectId, userId } = req.params;

  const project = await Project.findById(projectId);
  if (!project) return failure(res, 404, "Project not found");

  if (!project.owner.equals(req.user._id)) {
    return failure(res, 403, "Only the project owner can remove members");
  }
  if (project.owner.equals(userId)) {
    return failure(res, 400, "Cannot remove the project owner");
  }

  project.members = project.members.filter((m) => !m.equals(userId));
  await project.save();

  const team = await Team.findOne({ project: projectId });
  if (team) {
    team.members = team.members.filter((m) => !m.user.equals(userId));
    await team.save();
  }

  return success(res, 200, null, "Member removed");
});
