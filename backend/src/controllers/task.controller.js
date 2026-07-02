import Task from "../models/Task.js";
import Project from "../models/Project.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { success, failure } from "../utils/apiResponse.js";

// Helper — resolves the project and reports whether the current user has
// membership-level access (owner or accepted member).
async function loadProjectAccess(projectId, userId) {
  const project = await Project.findById(projectId);
  if (!project) return { project: null, allowed: false, notFound: true };
  const isOwner = project.owner.equals(userId);
  const isMember = project.members.some((m) => m.equals(userId));
  return { project, allowed: isOwner || isMember, isOwner, isMember };
}

// POST /api/tasks — any project member (or the owner) can create tasks.
export const createTask = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    project: projectId,
    assignedTo,
    deadline,
    priority,
    difficulty,
    estimatedTime,
  } = req.body;

  if (!title || !title.trim()) return failure(res, 400, "Title is required");
  if (!projectId) return failure(res, 400, "project is required");

  const { project, allowed, notFound } = await loadProjectAccess(
    projectId,
    req.user._id
  );
  if (notFound) return failure(res, 404, "Project not found");
  if (!allowed) {
    return failure(res, 403, "Only project members can create tasks");
  }

  const task = await Task.create({
    title,
    description,
    project: projectId,
    assignedTo: assignedTo || null,
    deadline: deadline || null,
    priority,
    difficulty,
    estimatedTime,
  });

  // Keep the Project.tasks index in sync so `GET /api/projects/:id` shows
  // this task in its populated list without a second query.
  project.tasks.push(task._id);
  await project.save();

  return success(res, 201, task, "Task created");
});

// GET /api/tasks/project/:projectId — owner or member only.
export const getTasksByProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const { allowed, notFound } = await loadProjectAccess(projectId, req.user._id);
  if (notFound) return failure(res, 404, "Project not found");
  if (!allowed) return failure(res, 403, "Not authorized to view these tasks");

  const tasks = await Task.find({ project: projectId })
    .populate("assignedTo", "name email profilePicture")
    .sort({ createdAt: -1 });

  return success(res, 200, tasks);
});

// PUT /api/tasks/:id — any project member can edit any task metadata other
// than status (status has its own stricter endpoint).
export const updateTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) return failure(res, 404, "Task not found");

  const { allowed, notFound } = await loadProjectAccess(task.project, req.user._id);
  if (notFound) return failure(res, 404, "Project not found");
  if (!allowed) return failure(res, 403, "Only project members can update tasks");

  const editable = [
    "title",
    "description",
    "assignedTo",
    "deadline",
    "priority",
    "difficulty",
    "estimatedTime",
  ];
  editable.forEach((field) => {
    if (req.body[field] !== undefined) task[field] = req.body[field];
  });

  await task.save();
  return success(res, 200, task, "Task updated");
});

// DELETE /api/tasks/:id — any project member can delete.
export const deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) return failure(res, 404, "Task not found");

  const { project, allowed, notFound } = await loadProjectAccess(
    task.project,
    req.user._id
  );
  if (notFound) return failure(res, 404, "Project not found");
  if (!allowed) return failure(res, 403, "Only project members can delete tasks");

  await task.deleteOne();

  project.tasks = project.tasks.filter((t) => !t.equals(task._id));
  await project.save();

  return success(res, 200, null, "Task deleted");
});

// PATCH /api/tasks/:id/status — assignee OR project owner only.
// Deliberately stricter than updateTask: a random member shouldn't be able
// to drag someone else's task to Done.
export const updateTaskStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!["todo", "in-progress", "done"].includes(status)) {
    return failure(res, 400, "status must be one of: todo, in-progress, done");
  }

  const task = await Task.findById(req.params.id);
  if (!task) return failure(res, 404, "Task not found");

  const project = await Project.findById(task.project);
  if (!project) return failure(res, 404, "Project not found");

  const isOwner = project.owner.equals(req.user._id);
  const isAssignee = task.assignedTo && task.assignedTo.equals(req.user._id);

  if (!isOwner && !isAssignee) {
    return failure(
      res,
      403,
      "Only the task assignee or project owner can change status"
    );
  }

  task.status = status;
  await task.save();
  return success(res, 200, task, "Task status updated");
});
