// Dashboard aggregate controller.
//
// GET /api/dashboard/summary       — one aggregated payload for the logged-in
//                                    user's stats cards + charts + deadlines.
// GET /api/dashboard/productivity  — tasks completed per day for the last 7
//                                    days, gap-filled with zeros so the chart
//                                    always renders a full week.
//
// Everything is scoped to the current user's projects (owner OR member) so
// data isolation matches the Phase-2 access rules.

import Project from "../models/Project.js";
import Task from "../models/Task.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { success } from "../utils/apiResponse.js";

// Helper: return the UTC midnight of the given date. We aggregate + gap-fill
// in UTC because Mongo's $dateToString defaults to UTC — using local time on
// either side would introduce off-by-one errors near midnight.
function utcMidnight(d = new Date()) {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
}

// GET /api/dashboard/summary
export const getSummary = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // 1. Projects the user owns or is a member of. Newest activity first.
  const projects = await Project.find({
    $or: [{ owner: userId }, { members: userId }],
  })
    .select("_id title status updatedAt owner members techStack")
    .sort({ updatedAt: -1 })
    .lean();

  const projectIds = projects.map((p) => p._id);

  const activeProjects = projects.filter(
    (p) => p.status === "planning" || p.status === "in-progress"
  ).length;
  const completedProjects = projects.filter(
    (p) => p.status === "completed"
  ).length;

  // 2. Task counts by status, across all the user's projects, in a single agg.
  const tasksByStatusAgg = projectIds.length
    ? await Task.aggregate([
        { $match: { project: { $in: projectIds } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ])
    : [];

  const tasksByStatus = { todo: 0, "in-progress": 0, done: 0 };
  for (const bucket of tasksByStatusAgg) {
    if (bucket._id in tasksByStatus) {
      tasksByStatus[bucket._id] = bucket.count;
    }
  }
  const totalTasks =
    tasksByStatus.todo + tasksByStatus["in-progress"] + tasksByStatus.done;
  const completedTasks = tasksByStatus.done;
  const pendingTasks = tasksByStatus.todo + tasksByStatus["in-progress"];

  // 3. Upcoming deadlines: not-done tasks with a deadline in the next 7 days.
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcomingDeadlineDocs = projectIds.length
    ? await Task.find({
        project: { $in: projectIds },
        status: { $ne: "done" },
        deadline: { $gte: now, $lte: sevenDaysFromNow },
      })
        .select("_id title deadline project priority status")
        .populate("project", "title")
        .sort({ deadline: 1 })
        .limit(20)
        .lean()
    : [];

  const upcomingDeadlines = upcomingDeadlineDocs.map((t) => ({
    taskId: t._id,
    title: t.title,
    deadline: t.deadline,
    priority: t.priority,
    status: t.status,
    projectId: t.project?._id || null,
    projectTitle: t.project?.title || "Untitled project",
  }));

  // 4. Last 5 recently-touched projects, for a quick-access row.
  const recentProjects = projects.slice(0, 5).map((p) => ({
    _id: p._id,
    title: p.title,
    status: p.status,
    updatedAt: p.updatedAt,
    techStack: p.techStack || [],
    isOwner: String(p.owner) === String(userId),
  }));

  return success(res, 200, {
    activeProjects,
    completedProjects,
    totalTasks,
    completedTasks,
    pendingTasks,
    upcomingDeadlines,
    tasksByStatus,
    recentProjects,
  });
});

// GET /api/dashboard/productivity
// Returns 7 buckets (oldest first, including today) of tasks completed per
// day, based on Task.updatedAt where status transitioned to "done".
export const getProductivity = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const projects = await Project.find({
    $or: [{ owner: userId }, { members: userId }],
  })
    .select("_id")
    .lean();
  const projectIds = projects.map((p) => p._id);

  const todayUtc = utcMidnight(new Date());
  const sevenDaysAgoUtc = new Date(
    todayUtc.getTime() - 6 * 24 * 60 * 60 * 1000
  );

  const agg = projectIds.length
    ? await Task.aggregate([
        {
          $match: {
            project: { $in: projectIds },
            status: "done",
            updatedAt: { $gte: sevenDaysAgoUtc },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" },
            },
            tasksCompleted: { $sum: 1 },
          },
        },
      ])
    : [];

  const byDate = Object.fromEntries(
    agg.map((row) => [row._id, row.tasksCompleted])
  );

  // Gap-fill every day in the 7-day window so the line chart always renders
  // the full range even on quiet weeks.
  const result = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgoUtc.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().slice(0, 10);
    result.push({ date: dateStr, tasksCompleted: byDate[dateStr] || 0 });
  }

  return success(res, 200, result);
});
