import Project from "../models/Project.js";
import Task from "../models/Task.js";
import Team from "../models/Team.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { success, failure } from "../utils/apiResponse.js";

// POST /api/projects
export const createProject = asyncHandler(async (req, res) => {
  const { title, description, repository, techStack, timeline, status } =
    req.body;

  if (!title || !title.trim()) {
    return failure(res, 400, "Title is required");
  }

  const project = await Project.create({
    title,
    description,
    owner: req.user._id,
    // `members` intentionally starts empty. The owner is not a member of their
    // own team — that would double-count them in every access check.
    members: [],
    repository,
    techStack,
    timeline,
    status,
  });

  return success(res, 201, project, "Project created");
});

// GET /api/projects — projects the current user owns OR is a member of.
export const getProjects = asyncHandler(async (req, res) => {
  const projects = await Project.find({
    $or: [{ owner: req.user._id }, { members: req.user._id }],
  })
    .populate("owner", "name email profilePicture")
    .populate("members", "name email profilePicture")
    .sort({ createdAt: -1 });

  return success(res, 200, projects);
});

// GET /api/projects/:id
export const getProjectById = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id)
    .populate("owner", "name email profilePicture")
    .populate("members", "name email profilePicture")
    .populate("tasks");

  if (!project) return failure(res, 404, "Project not found");

  const isOwner = project.owner._id.equals(req.user._id);
  const isMember = project.members.some((m) => m._id.equals(req.user._id));

  if (!isOwner && !isMember) {
    return failure(res, 403, "Not authorized to view this project");
  }

  return success(res, 200, project);
});

// PUT /api/projects/:id — owner only.
export const updateProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return failure(res, 404, "Project not found");

  if (!project.owner.equals(req.user._id)) {
    return failure(res, 403, "Only the project owner can update the project");
  }

  const editable = [
    "title",
    "description",
    "repository",
    "techStack",
    "timeline",
    "status",
  ];
  editable.forEach((field) => {
    if (req.body[field] !== undefined) project[field] = req.body[field];
  });

  await project.save();
  return success(res, 200, project, "Project updated");
});

// DELETE /api/projects/:id — owner only. Cascades to tasks + team.
export const deleteProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return failure(res, 404, "Project not found");

  if (!project.owner.equals(req.user._id)) {
    return failure(res, 403, "Only the project owner can delete the project");
  }

  await Task.deleteMany({ project: project._id });
  await Team.deleteOne({ project: project._id });
  await project.deleteOne();

  return success(res, 200, null, "Project deleted");
});
