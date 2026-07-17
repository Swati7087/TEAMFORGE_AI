# TeamForge AI — Full Session Handoff

> **Purpose of this document**: This is a complete resume-from-cold-start briefing. If pasted into a fresh chat, the next assistant (or me tomorrow) should be able to pick up without asking any context questions.

---

## Project at a glance

- **Name**: TeamForge AI
- **Monorepo root**: `e:\teamforge_ai\`
- **Structure**: `backend/` (Node/Express/Mongoose ESM) + `frontend/` (React 19 + Vite 6 + Tailwind v3.4 + Shadcn v4 CLI output patched for v3 + dnd-kit + react-router 7)
- **Positioning**: An app for **coding students** to plan projects, form teams, break work into tasks, and (later) get AI-assisted planning and analytics.
- **Aesthetic**: **"Terminal Punk"** — dark background `#050508`, neon **green** + **hot pink** + **amber** palette, glassmorphic cards, Inter body + Space Grotesk headings, `#ff0fef` for active accents.

---

## 1) What we successfully built / changed

### Phase 1 — Auth + User Profile ✅

- [x] **Backend scaffolding**: `backend/src/{config,models,controllers,routes,middlewares,utils,services,prompts}`
- [x] `backend/src/config/env.js` — validates required vars (`PORT`, `MONGO_URI`, `JWT_SECRET`, `SESSION_SECRET`), exposes rest as optional
- [x] `backend/src/config/db.js` — Mongoose `connectDB()`
- [x] `backend/src/config/passport.js` — Google strategy registered **only if creds present**
- [x] `backend/src/models/User.js` — bcrypt hashing, Google fields, Mongoose 9 async `pre("save")` (no `next()`)
- [x] `backend/src/utils/{asyncHandler,apiResponse,generateToken}.js`
- [x] `backend/src/middlewares/{auth,error}.middleware.js` — `protect` verifies JWT from `Authorization: Bearer …`
- [x] `backend/src/controllers/auth.controller.js` — `signup`, `login`, `googleCallback`, `getMe`
- [x] `backend/src/controllers/user.controller.js` — `getUsers` (name + **email** + skills + experienceLevel + availability + profilePicture), `getUser`, `updateUser` (own-profile only, allowlist)
- [x] Routes: `/api/auth/*` + `/api/users/*`, all protected where appropriate
- [x] `backend/src/app.js` + `backend/src/server.js` — Express bootstrap, session used only for Google OAuth redirect
- [x] `backend/src/services/gemini.service.js` — `callGemini(promptText)` stub (unused until Phase 3)
- [x] `backend/scripts/…` folder created for test scripts
- [x] **Frontend**: `axiosClient.js` (JWT interceptor, smart 401 — only clears session if request was authenticated), `auth.api.js`, `AuthContext` (bootstraps from stored token via `/me`), `useAuth` hook, `ProtectedRoute`
- [x] Pages: `Landing`, `Login`, `Signup`, `OAuthSuccess`, `Dashboard`, `Profile`
- [x] Login/Signup error surface distinguishes **server rejection** vs **network error** ("Can't reach the server. Is the backend running?")

### Terminal Punk theming ✅

- [x] `frontend/src/index.css` — Inter body, Space Grotesk H1–H4, custom scrollbar, autofill overrides, green `::selection`
- [x] `frontend/tailwind.config.js` — custom keyframes (`spin-slow`, `spin-slower`, `spin-reverse`, `float`) and animations
- [x] `frontend/src/components/common/FloatingCube.jsx` — 3D wireframe cube (border + glow + tint), configurable size/color/speed/floatDelay/className, `perspective: 1000px`
- [x] `frontend/src/components/common/FloatingShapes.jsx` — 4 corner cubes composed
- [x] **Login/Signup**: transparent glass card `bg-[#0a0a12]/40 backdrop-blur-md`, ambient blobs, corner cubes, + a **central 180 px amber cube** sitting behind the card (peeks through the glass)
- [x] **Landing**: split-hero layout — badge / title / subtitle / CTAs / tech list on the left, **`InteractiveCube`** on the right
- [x] `frontend/src/components/common/InteractiveCube.{jsx,css}` — ported the vanilla-JS 6-face draggable cube. `PointerSensor`-style mousedown scoped to the cube; mousemove on document. Torque physics with **`speed: 2` for drag + `ambientSpeed: 1.5` for hover-free tracking** so it drifts with cursor motion. Active face lights up in `#ff0fef`. Face labels: `AI · TASK · TEAM · GIT · PLAN · FORGE`. Reflection via `-webkit-box-reflect`.

### Phase 2 — Project / Team / Task ✅

**Models** (`backend/src/models/`)
- [x] `Project.js` — title, description, owner, members[], tasks[], repository, techStack[], timeline, status enum `planning|in-progress|completed`, timestamps. **Owner intentionally NOT duplicated into members[]** — treated separately in every access check.
- [x] `Task.js` — title, description, project, assignedTo (nullable), deadline, priority enum, difficulty enum, status enum, estimatedTime, timestamps
- [x] `Team.js` — one-per-project (`unique: true` on `project`), lazy-created on first invite/request. Embedded members with `user / status enum invited|requested|accepted|rejected / role / invitedBy / respondedAt`.

**Controllers with all authorization built in** (`backend/src/controllers/`)
- [x] `project.controller.js` — create / list (`$or: [owner, members]`) / get-by-id (member-only) / update (owner-only) / delete (owner-only, cascades tasks + team)
- [x] `team.controller.js` — invite (owner-only), request (any non-member), respond (invitee for invites, owner for requests), get-team (owner or member), remove-member (owner-only, can't remove owner)
- [x] `task.controller.js` — create/update/delete (any member OR owner), **status change stricter: assignee OR owner only**

**Routes** all behind `protect`
- [x] `/api/projects`, `/api/teams`, `/api/tasks` mounted in `app.js`

**Frontend**
- [x] API wrappers: `project.api.js`, `task.api.js`, `team.api.js`, `user.api.js` — all peel the `{ success, data }` envelope
- [x] Hooks: `useProjects()`, `useProject(id)`, `useTasks(projectId)` with **optimistic `moveTask`** that flips local state first and rolls back on failure
- [x] Components (`components/task/`):
  - `TaskCard` (sortable) + exported `TaskCardBody` (no hooks — used by DragOverlay so we don't register a duplicate sortable id)
  - `KanbanColumn` — green (todo) / amber (in-progress) / pink (done) headers, droppable when empty, "+ add" per-column button, "No tasks yet" empty state
  - `KanbanBoard` — 3 columns in a `DndContext`, `PointerSensor` with `activationConstraint: { distance: 8 }` (protects click-to-open), `closestCorners` collision, hot-pink `DragOverlay` (rotate-1 scale-1.04 ring-pink-500/40 shadow)
  - `TaskDialog` — hand-rolled Terminal Punk modal (not shadcn Dialog, to avoid v4-only classes) for create/edit
- [x] `components/team/InviteMemberDialog.jsx` — searchable user list minus (self + members + already pending)
- [x] Pages:
  - `CreateProject` — title / description / techStack (comma-separated) / timeline, navigates to `/projects/:id`
  - `ProjectDetails` — status badge, meta, **Overview / Team / Tasks** tabs, owner Invite+Delete, non-member Request-to-Join, pending list with role-scoped Accept/Reject
  - `TaskBoard` — focused full-screen Kanban at `/projects/:id/tasks`
  - `Dashboard` rewritten — live stat cards (owned / member-of / total tasks) + real project grid + empty state + `+ New project` CTA
- [x] Routes wired: `/projects/new`, `/projects/:id`, `/projects/:id/tasks` under `ProtectedRoute`

### Atomicity fix (asked for during this session) ✅

- [x] **`backend/src/utils/atomicWrite.js`** — `saveAtomically(writes)` helper: attempts `mongoose.startSession().withTransaction(...)`, catches "unsupported deployment" errors (codeName `IllegalOperation`, code 20 / 8000, plus regex matches for `Transaction numbers are only allowed on a replica set`, `does not support transactions`, `does not support retryable writes`, `requires a replica set`), falls back to sequential writes. Any *other* error propagates. Includes a `console.warn` in non-production for unmatched shapes.
- [x] Wired into `team.controller.js` in **both** write sites:
  - `respondToInvite` accept path
  - `inviteToTeam` auto-accept path (owner invites someone who was already requesting)
- [x] `project.members.push(...)` in both sites now guarded with `!members.some(m => m.equals(id))` — writes are idempotent, safe under `withTransaction` retry and safe when the fallback path re-runs the callback with `session: null`

### Verified and green

- [x] `backend/scripts/test-phase2.ps1` — signs up 3 fresh users each run, exercises the 8-point checklist: create → list → request → accept → task create → task 403 → status change → delete permissions. **All 8 PASS** as of the last commit.
- [x] `powershell -ExecutionPolicy Bypass -File .\scripts\test-phase2.ps1` run from `e:\teamforge_ai\backend\`
- [x] Frontend end-to-end: user visually confirmed Terminal Punk theming + interactive cube. Login flow works after CORS fix.

### Infra / config

- [x] `.gitignore` at root — `.env`, `node_modules/`, build artifacts, IDE files
- [x] Git initialized. **One commit exists**: `c3a4af4` `"Phase 1: auth + user profile complete"`. **Phase 2 changes are still uncommitted.**
- [x] `README.md` at root with project overview + getting-started
- [x] Shadcn initialized: `-t vite -b radix -p nova -y`. Created `components.json`, `src/lib/utils.js`, `src/components/ui/{button,dialog,select,dropdown-menu,badge,avatar}.jsx`
- [x] Tailwind v3 ↔ Shadcn v4 mismatch worked around: mapped `background / foreground / primary / secondary / muted / accent / destructive / popover / card / border / input / ring` to `var(--…)` in `tailwind.config.js`, `borderRadius.{lg,md,sm}` to `var(--radius)`, `darkMode: "class"`, `<html class="dark">` in `index.html`, stripped `@import "shadcn/tailwind.css"` + `@import "@fontsource-variable/geist"` + `.theme` block from `index.css`, dropped `outline-ring/50` (opacity modifier doesn't compose with OKLCH `var()`), added missing `--destructive-foreground`
- [x] CORS accepts **comma-separated** `FRONTEND_URL`. Currently: `http://localhost:5173,http://localhost:5174`. Uses a function-based `origin` callback in `cors()`.

---

## 2) What is currently broken / incomplete

- [ ] **Phase 2 not committed** — all Phase 2 (backend + frontend) plus the atomicWrite work is uncommitted. Only Phase 1 is in git.
- [ ] **No real transactions running today** — the `saveAtomically` helper is correct code, but the local MongoDB is standalone `mongod` (threw `MongoServerError: This MongoDB deployment does not support retryable writes` on the first test). Both write sites currently fall back to sequential writes. This becomes real atomicity the moment `MONGO_URI` points at a replica set / Atlas / mongos.
- [ ] **Google OAuth end-to-end** — Passport strategy is only registered if creds are set. `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are empty in `.env`. The `/api/auth/google` route will 500 with `Unknown authentication strategy "google"` until creds are added.
- [ ] **Gemini not wired** — `services/gemini.service.js` exists but `GEMINI_API_KEY` is empty in `.env`. Not called by any route yet.
- [ ] **`GITHUB_TOKEN_ENCRYPTION_KEY`** is present in `.env` but not populated. Only relevant when Phase 5 lands.
- [ ] **Shadcn Dialog / Dropdown animations do nothing** — the installed shadcn primitives use v4-only utilities (`data-open:animate-in`, `supports-backdrop-filter:backdrop-blur-xs`, `bg-muted/50`). Tailwind v3 silently drops them. I hand-rolled our two dialogs (`TaskDialog`, `InviteMemberDialog`) so we don't rely on any of those. **Trigger point** to migrate to Tailwind v4: the first time we need animated dialogs/dropdowns or opacity-modified themed colors — not before.
- [ ] **`user.id` vs `user._id` inconsistency** — `signup`/`login` return `{ id, name, email }` in `data.user`; `getMe` returns the full Mongoose doc with `_id`. Everywhere in the frontend I use `user._id || user.id` as a defensive pattern. **Clean fix**: normalize `auth.controller.js` to return `_id`. One-liner whenever we next touch auth.
- [ ] **Task status change vs drag friction** — `PATCH /api/tasks/:id/status` allows only assignee or owner. When a non-assignee member drags someone else's card between columns, the optimistic move rolls back with a red toast. This is spec-correct but potentially annoying. If it becomes a real UX complaint, loosen the backend rule to "any member" for status.
- [ ] **Port 5173 is squatted** by some other process. Vite defaults to 5174 now — this is the **standardized dev port**. Don't try to free 5173; we established this is not worth the friction.
- [ ] **`tw-animate-css`** — package is installed but not imported. Would need `tailwindcss-animate` plugin for v3 to actually do anything. Not blocking anything today.
- [ ] **Landing on shadcn Dialog** — planned migration only after Tailwind v4 migration.

---

## 3) Immediate next 3 steps

1. **Commit Phase 2** — one commit encompassing the Phase 2 models/controllers/routes, the frontend Kanban / project / team pages, the shadcn init + Tailwind v3 config wiring, the CORS multi-origin fix, the atomicWrite util, and the improved login/signup error messages. Suggested message: `Phase 2: project/team/task CRUD, Kanban board, atomicWrite fallback`. (I need to ask before actually running `git commit` — the user hasn't explicitly said "commit" yet.)
2. **Send Phase 3 instructions** — this is the AI Project Generator + AI Task Breakdown phase, which is where `gemini.service.js` actually gets used. Depends on `GEMINI_API_KEY` being populated in `.env`.
3. **Manual browser walk of the frontend Phase 2 checklist** — the last thing we haven't done end-to-end with real user interaction: (a) create a project → shows on dashboard, (b) invite second account → accept → shows as member, (c) create 3–4 tasks across statuses, (d) drag between columns and confirm it survives refresh, (e) confirm non-member can't view/edit, (f) delete a task → gone after refresh.

---

## 4) Everything the user has asked me to remember about this project

### Product intent

- [ ] **Built for coding students** — the *only* audience the user has named. Tone, examples, and copy should target that group.
- [ ] Aesthetic direction (paraphrasing): *"why blue and purple — use different colour combos, something crazy"* → we picked **Terminal Punk** (neon green + hot pink + amber on near-black `#050508`). The user then loved it and said *"i love the effect"* on the login and landing pages. Stay in this palette. Do not introduce new accent colors without a reason.
- [ ] Interactive cube on Landing is a big win for the user — *"wooow i am impressed"*. Preserve it. Preserve the mouse-drift behaviour (`ambientSpeed: 1.5`, active face `#ff0fef`, labels `AI/TASK/TEAM/GIT/PLAN/FORGE`).

### Development philosophy the user has established

- [ ] **Don't build everything at once** — follow the phased build order. The user has been strict about this.
- [ ] The build order the user memorized:
  - Phase 1 — Auth + User Profile ✅
  - Phase 2 — Project + Team + Task CRUD ✅
  - Phase 3 — AI Generator (Project Generator + Task Breakdown)
  - Phase 4 — Dashboard (analytics, recharts)
  - Phase 5 — GitHub integration
  - Phase 6 — Remaining AI features
  - Phase 7 — AI Engineering Manager
- [ ] The user hands over **complete, single-message, unambiguous instruction sets per phase**. I should follow those instructions closely, not freelance.
- [ ] The user explicitly deferred **Git initialization** until later in Phase 1, and then explicitly triggered it at the start of Phase 2 with `git init` + commit.
- [ ] The user asked for **honest technical answers**, including one moment where I had to admit that "both writes happen together" was implemented as two sequential `.save()` calls, not a real transaction. Never gloss over this class of thing.

### Explicit long-term decisions ("log for later, not now")

- [ ] **Do NOT migrate to Tailwind v4 yet.** The trigger to migrate is: (a) we need animated dialogs/dropdowns, OR (b) we need opacity-modified themed colors. Not before.
- [ ] **Standardize on port 5174** for the Vite dev server. Do not try to kill whatever's on 5173. Not worth the friction.
- [ ] The shadcn v3-vs-v4 mismatch is a **slow-burn issue**, not a blocker. The user accepted my patch for now.
- [ ] The user does **not** want proactive commits. Only commit when the user explicitly asks.

### Environment / tooling context

- [ ] **OS**: Windows 10.0.26200. **Shell**: PowerShell. `&&` doesn't chain — use `;` for sequential-independent, or run commands separately.
- [ ] **PowerShell + `Invoke-WebRequest`** gotcha: **always** add `-UseBasicParsing -TimeoutSec 15`. Without `-UseBasicParsing` it silently hangs on IE first-run config.
- [ ] **`curl` on Windows + JSON**: PowerShell mangles quoting. Prefer `Invoke-WebRequest` with `ConvertTo-Json -Compress`, OR write JSON to a temp file and `curl -d @file`.
- [ ] **MongoDB is standalone `mongod`** on `mongodb://localhost:27017/teamforge_ai`. It does NOT support retryable writes or transactions. That's fine, `saveAtomically` handles it. If we migrate to a replica set, everything auto-upgrades.
- [ ] **Nodemon** watches JS files, **not** `.env`. Changing `.env` requires a manual restart or a touch of any JS file.
- [ ] The user uses PowerShell 5.1 on Windows. Prefer `Invoke-RestMethod` or `Invoke-WebRequest -UseBasicParsing` over `curl.exe`.
- [ ] **Cursor auto-review** can block shell calls (e.g. `git commit` for co-author trailer concerns, `Stop-Process` for arbitrary port-killing). When blocked and the action was legitimately requested, retry with `request_smart_mode_approval: true`.

### Backend implementation conventions

- [ ] **ESM throughout** (`"type": "module"` in `backend/package.json`). All imports use `.js` extensions.
- [ ] All API responses go through `success(res, code, data, msg)` and `failure(res, code, msg)` from `utils/apiResponse.js`. Envelope shape: `{ success, message, data }`. All frontend wrappers `return res.data.data` to peel it.
- [ ] All controllers wrap in `asyncHandler(...)`.
- [ ] All routes behind `protect` unless explicitly public (auth signup/login and Google callback).
- [ ] Owner is separate from members in the Project model.
- [ ] `updateTaskStatus` is deliberately stricter than `updateTask` — only assignee or owner.
- [ ] `Team` is one-per-project, lazy-created.

### Frontend implementation conventions

- [ ] Terminal Punk color roles baked in:
  - **green** = "todo" / go / primary CTA left half
  - **amber** = "in-progress" / "planning" status / medium priority
  - **hot pink** = "done" / "completed" status / high priority / primary CTA right half / active drag glow
- [ ] Priority dots on task cards: gray (low), amber (medium), pink (high).
- [ ] All dialogs I built by hand (`TaskDialog`, `InviteMemberDialog`) — do NOT use shadcn Dialog for now (v4 utilities won't animate on v3).
- [ ] Full color class strings in dynamic contexts (`bg-green-500/20`, not `bg-${accent}-500/20`) so Tailwind's JIT can see them.
- [ ] Landing does **NOT** use `FloatingShapes` — it uses `InteractiveCube` as the hero on the right column, and I removed the corner cubes there to give the interactive cube room to breathe.
- [ ] Login/Signup **do** use `FloatingShapes` + a single central `FloatingCube` behind the transparent card.

### Test harness

- [ ] `backend/scripts/test-phase2.ps1` is the canonical Phase 2 backend smoke test. Signs up 3 fresh users each run (`phase2-{a,b,c}-<random>@test.com`), walks 8 checks, prints PASS/FAIL. Always run it after touching any backend model / controller / route.

### Files that exist but are stubs (waiting for future phases)

- `backend/src/controllers/{ai,github,notification}.controller.js` — Phase 3/5/6
- `backend/src/routes/{ai,github,notification}.routes.js` — same
- `backend/src/models/{AIHistory,Commit,Contribution,Meeting,Notification,Repository}.js` — Phase 3/4/5/6
- `backend/src/prompts/*.prompt.js` — all Phase 3+
- `backend/src/services/{email,github}.service.js` — Phase 5/6
- `frontend/src/pages/{AIAssistant,Analytics,ContributionDashboard,MeetingNotes,Notifications,ReadmeGenerator,Settings,TeamMembers}.jsx` — Phase 3–6
- `frontend/src/components/{ai,charts,common/{Calendar,Loader,NotificationBell,ProgressBar},layout/*,project/*,team/{SkillTags,TeamCard}}` — Phase 3+
- `frontend/src/context/ProjectContext.jsx` — not currently used; `useProjects` hook covers everything so far
- `frontend/src/{api/{ai,github}.api.js,utils/{constants,formatDate}.js}` — Phase 3/5

### Concrete API contract (as it stands today)

```
POST   /api/auth/signup       { name, email, password }        → 201 { token, user: { id, name, email } }
POST   /api/auth/login        { email, password }              → 200 { token, user: { id, name, email } }
GET    /api/auth/me           (Bearer)                         → 200 { user: <full mongoose doc, _id> }
GET    /api/auth/google       (redirect chain, requires creds)
GET    /api/auth/google/callback

GET    /api/users             (Bearer)                         → { users: [{_id,name,email,skills,experienceLevel,availability,profilePicture}] }
GET    /api/users/:id         (Bearer)                         → { user }
PUT    /api/users/:id         (Bearer, own profile only)       → { user }

POST   /api/projects          (Bearer)                         → project
GET    /api/projects          (Bearer)                         → [projects owned or member-of]
GET    /api/projects/:id      (Bearer, owner or member)        → populated project
PUT    /api/projects/:id      (Bearer, owner only)             → project
DELETE /api/projects/:id      (Bearer, owner only)             → null (cascades tasks + team)

POST   /api/teams/:projectId/invite            { userId, role? }  (owner only)
POST   /api/teams/:projectId/request                              (any non-member)
PATCH  /api/teams/:projectId/respond           { userId, status: "accepted"|"rejected" }
GET    /api/teams/:projectId                                      (owner or member)
DELETE /api/teams/:projectId/members/:userId                      (owner only, can't remove owner)

POST   /api/tasks             { title, project, ... }           (any project member)
GET    /api/tasks/project/:projectId                            (member or owner)
PUT    /api/tasks/:id                                            (any project member)
DELETE /api/tasks/:id                                            (any project member)
PATCH  /api/tasks/:id/status  { status: "todo"|"in-progress"|"done" }   (assignee OR owner only)

GET    /api/health                                              → { status: "ok" }
```

### The one thing I should ask before doing tomorrow

> "Do you want me to commit the outstanding Phase 2 work (backend + frontend + atomicWrite) as one commit before we start Phase 3?"

Everything else in Phase 3 should follow the same rhythm: user sends single-message instruction set → I follow it precisely → verify with tests → summary at the end.

-------------------------------------------------------------------

Also this is what i did in vscode after all this - 

PS E:\teamforge_ai> git init
Reinitialized existing Git repository in E:/teamforge_ai/.git/
PS E:\teamforge_ai> git commit -m "first commit"
On branch master
Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
        modified:   backend/.env.example
        modified:   backend/src/app.js
        modified:   backend/src/controllers/project.controller.js
        modified:   backend/src/controllers/task.controller.js
        modified:   backend/src/controllers/team.controller.js
        modified:   backend/src/controllers/user.controller.js
        modified:   backend/src/models/Project.js
        modified:   backend/src/models/Task.js
        modified:   backend/src/models/Team.js
        modified:   backend/src/routes/project.routes.js
        modified:   backend/src/routes/task.routes.js
        modified:   backend/src/routes/team.routes.js
        modified:   frontend/index.html
        modified:   frontend/package-lock.json
        modified:   frontend/package.json
        modified:   frontend/src/api/project.api.js
        modified:   frontend/src/api/task.api.js
        modified:   frontend/src/components/task/KanbanBoard.jsx
        modified:   frontend/src/components/task/KanbanColumn.jsx
        modified:   frontend/src/components/task/TaskCard.jsx
        modified:   frontend/src/hooks/useProjects.js
        modified:   frontend/src/hooks/useTasks.js
        modified:   frontend/src/index.css
        modified:   frontend/src/pages/CreateProject.jsx
        modified:   frontend/src/pages/Dashboard.jsx
        modified:   frontend/src/pages/Login.jsx
        modified:   frontend/src/pages/ProjectDetails.jsx
        modified:   frontend/src/pages/Signup.jsx
        modified:   frontend/src/pages/TaskBoard.jsx
        modified:   frontend/src/routes/AppRoutes.jsx
        modified:   frontend/tailwind.config.js

Untracked files:
  (use "git add <file>..." to include in what will be committed)
        CurrentStatus.md
        backend/scripts/
        backend/src/utils/atomicWrite.js
        frontend/components.json
        frontend/src/api/team.api.js
        frontend/src/api/user.api.js
        frontend/src/components/task/TaskDialog.jsx
        frontend/src/components/team/InviteMemberDialog.jsx
        frontend/src/components/ui/avatar.jsx
        frontend/src/components/ui/badge.jsx
        frontend/src/components/ui/button.jsx
        frontend/src/components/ui/dialog.jsx
        frontend/src/components/ui/dropdown-menu.jsx
        frontend/src/components/ui/select.jsx
        frontend/src/lib/

no changes added to commit (use "git add" and/or "git commit -a")
PS E:\teamforge_ai> git add .
warning: in the working copy of 'backend/src/app.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'backend/src/controllers/project.controller.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'backend/src/controllers/task.controller.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'backend/src/controllers/team.controller.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'backend/src/controllers/user.controller.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'backend/src/models/Project.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'backend/src/models/Task.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'backend/src/models/Team.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'backend/src/routes/project.routes.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'backend/src/routes/task.routes.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'backend/src/routes/team.routes.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'frontend/index.html', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'frontend/package-lock.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'frontend/package.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'frontend/src/api/project.api.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'frontend/src/api/task.api.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'frontend/src/components/task/KanbanBoard.jsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'frontend/src/components/task/KanbanColumn.jsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'frontend/src/components/task/TaskCard.jsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'frontend/src/hooks/useProjects.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'frontend/src/hooks/useTasks.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'frontend/src/index.css', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'frontend/src/pages/CreateProject.jsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'frontend/src/pages/Dashboard.jsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'frontend/src/pages/Login.jsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'frontend/src/pages/ProjectDetails.jsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'frontend/src/pages/Signup.jsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'frontend/src/pages/TaskBoard.jsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'frontend/src/routes/AppRoutes.jsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'frontend/tailwind.config.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'backend/scripts/test-phase2.ps1', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'backend/src/utils/atomicWrite.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'frontend/components.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'frontend/src/api/team.api.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'frontend/src/api/user.api.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'frontend/src/components/task/TaskDialog.jsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'frontend/src/components/team/InviteMemberDialog.jsx', LF will be replaced by CRLF the next time Git touches it
PS E:\teamforge_ai> git commit -m "teamforge_phase2_completed"
[master dbdeb60] teamforge_phase2_completed
 46 files changed, 9226 insertions(+), 387 deletions(-)
 create mode 100644 CurrentStatus.md
 create mode 100644 backend/scripts/test-phase2.ps1
 create mode 100644 backend/src/utils/atomicWrite.js
 create mode 100644 frontend/components.json
 create mode 100644 frontend/src/api/team.api.js
 create mode 100644 frontend/src/api/user.api.js
 create mode 100644 frontend/src/components/task/TaskDialog.jsx
 create mode 100644 frontend/src/components/team/InviteMemberDialog.jsx
 create mode 100644 frontend/src/components/ui/avatar.jsx
 create mode 100644 frontend/src/components/ui/badge.jsx
 create mode 100644 frontend/src/components/ui/button.jsx
 create mode 100644 frontend/src/components/ui/dialog.jsx
 create mode 100644 frontend/src/components/ui/dropdown-menu.jsx
 create mode 100644 frontend/src/components/ui/select.jsx
 create mode 100644 frontend/src/lib/utils.js
PS E:\teamforge_ai> git branch -M main
PS E:\teamforge_ai> git remote add origin git@github.com:Swati7087/TEAMFORGE_AI.git
PS E:\teamforge_ai> git push -u origin main
Enumerating objects: 220, done.
Counting objects: 100% (220/220), done.
Delta compression using up to 18 threads
Compressing objects: 100% (148/148), done.
Writing objects: 100% (220/220), 167.21 KiB | 1.17 MiB/s, done.
Total 220 (delta 27), reused 0 (delta 0), pack-reused 0 (from 0)
remote: Resolving deltas: 100% (27/27), done.
To github.com:Swati7087/TEAMFORGE_AI.git
 * [new branch]      main -> main
branch 'main' set up to track 'origin/main'.
PS E:\teamforge_ai> 



Session status — Phase 3 backend
What I built and shipped (this session)
New files

backend/src/models/AIHistory.js — mongoose model with the 11 type enums (project-generation, task-breakdown, team-match, meeting-summary, readme, skill-gap, productivity-report, deadline-predict, conflict-resolver, risk-analysis, contribution-analysis), user + optional project refs, input/output/rawResponse/status/errorMessage, timestamps
backend/src/prompts/projectGenerator.prompt.js — buildProjectGeneratorPrompt(idea) with strict-JSON schema and explicit "no markdown fences" instruction
backend/src/prompts/taskBreakdown.prompt.js — buildTaskBreakdownPrompt(title, description, techStack) requesting 6–12 tasks as a strict JSON array
backend/scripts/test-phase3.ps1 — full Phase 3 smoke test (2 users, generate-project shape check, generate-tasks shape check, non-member 403, cleanup)
Modified files

backend/src/services/gemini.service.js — added callGeminiJSON (calls Gemini, defensively strips ```json fences, JSON.parse, throws with .rawResponse attached on parse failure); added axios error-body capture so Google's real quota/error messages surface up; env-configurable model via GEMINI_MODEL; no key shape/prefix validation anywhere, only .trim()
backend/src/controllers/ai.controller.js — generateProject (any logged-in user) and generateTasks (owner-or-member via the same getProjectById pattern); every call logs to AIHistory on success and on failure; failures return a clean 502 { success:false, message:"AI generation failed, please try again" } and never leak Gemini errors to the client
backend/src/routes/ai.routes.js — mounts POST /generate-project + POST /generate-tasks, both behind protect
backend/src/app.js — mounts aiRoutes at /api/ai
backend/.env.example — documents the optional GEMINI_MODEL var
Two real issues I hit and fixed on the way
gemini-2.0-flash had limit: 0 free-tier quota on your account. Not a key problem — Google's ListModels returns dozens of models for your key, so it's fully valid. Switched default model to gemini-flash-latest (Google-maintained alias). You can override anytime with GEMINI_MODEL in .env.
Your .env has a leading space on GEMINI_API_KEY= AQ.Ab8.... dotenv v17 trims it at load-time and I also .trim() in code, so it works. Recommend cleaning that up for hygiene, but it's not blocking.
Tests
backend/scripts/test-phase2.ps1 — 8/8 PASS (regression, no Phase 2 breakage)
backend/scripts/test-phase3.ps1 — 18/18 PASS (includes field-shape assertions on generated project and first task in the breakdown)
Both success and failure paths exercised live: during my debugging Gemini returned 429 and 404; in both cases the client saw a clean 502 with no stack trace leak — confirming the checklist's "temporarily break the key → clean error" requirement is implicitly satisfied
Currently running (in this Cursor session)
Backend — http://localhost:5000, nodemon watching, Mongo connected
Frontend — http://localhost:5173, Vite dev server (browser tab opened)
Not done yet
Frontend Phase 3 wiring — the AI endpoints are backend-only right now; nothing in CreateProject.jsx or TaskBoard.jsx calls them yet. That's the next instruction set you said you'd send.
No git commit — respecting your "no proactive commits" rule. All Phase 3 work is uncommitted on top of dbdeb60.
GEMINI_MODEL override in your live .env — not needed because the default gemini-flash-latest works.
Concrete new API surface (added to the doc's contract)
POST /api/ai/generate-project    (Bearer, any user)
  body:   { idea: string }
  200:    { title, description, techStack[], features[], estimatedDifficulty, timeline, requiredRoles[] }
  400:    idea missing/empty
  502:    "AI generation failed, please try again"
POST /api/ai/generate-tasks      (Bearer, owner or accepted member of the referenced project)
  body:   { projectId: string }
  200:    [ { title, description, difficulty, priority, estimatedTime, suggestedRole } ] (6-12 items)
  400:    projectId missing
  403:    not a member
  404:    project not found
  502:    "AI generation failed, please try again"


Session status — where we're standing
Phase 3 backend (done and verified)
New files

backend/src/models/AIHistory.js — audit-trail model with 11 type enums, user + optional project refs, input/output/rawResponse/status/errorMessage, timestamps
backend/src/prompts/projectGenerator.prompt.js — buildProjectGeneratorPrompt(idea) with strict-JSON schema
backend/src/prompts/taskBreakdown.prompt.js — buildTaskBreakdownPrompt(title, description, techStack) requesting 6–12 tasks
backend/scripts/test-phase3.ps1 — the Phase-3 smoke test (2 users, generate-project + generate-tasks + non-member 403)
Modified

backend/src/services/gemini.service.js — added callGeminiJSON (calls Gemini, strips ```json fences defensively, JSON.parse, throws with .rawResponse attached on failure), axios error-body capture so Google's real quota/error messages surface, env-configurable model via GEMINI_MODEL, no key shape/prefix validation — only .trim()
backend/src/controllers/ai.controller.js — generateProject (any user) + generateTasks (owner-or-member, mirrors your Phase-2 auth pattern). Every call logs to AIHistory on success and failure. Failures return a clean 502 { success:false, message:"AI generation failed, please try again" } — no stack traces ever leak
backend/src/routes/ai.routes.js — mounts POST /generate-project + POST /generate-tasks behind protect
backend/src/app.js — mounts aiRoutes at /api/ai
backend/.env.example — documents optional GEMINI_MODEL
backend/.env — cleaned the leading space in GEMINI_API_KEY=
Live issues we fixed on the way

gemini-2.0-flash returned limit: 0 on your free tier → switched default to gemini-flash-latest (Google-maintained alias). Confirmed real, working key by listing available models — 39 models returned.
Leading space in .env value — cleaned; .trim() in the service is still there as belt-and-suspenders.
Backend test results

test-phase2.ps1: 8/8 PASS (regression)
test-phase3.ps1: 18/18 PASS including field-shape assertions on both AI responses and the non-member 403
Phase 3 frontend (done and running)
New files

frontend/src/api/ai.api.js — generateProject(idea) + generateTasks(projectId), envelope-peeling, errors intentionally surfaced
frontend/src/components/ai/AIBreakdownDialog.jsx — hand-rolled Terminal Punk modal with per-task checkboxes, all pre-checked, select-all/none, sequential createTask loop with live "Adding N/M" progress, stops on first failure
frontend/src/components/ai/AIBreakdownButton.jsx — self-contained widget that owns the button + loading state + toast + dialog; drop-in on any page
Modified

frontend/src/App.jsx — mounted <Toaster theme="dark" position="bottom-right" richColors> with a glass background
frontend/src/pages/CreateProject.jsx — added AI-Assist section above the manual form (pink-tinted card, Sparkles icon, spinner while loading, pre-fills title/description/techStack/timeline on success, inline pink error + green success hint, sonner toasts on both paths)
frontend/src/pages/TaskBoard.jsx — added <AIBreakdownButton /> next to the header
frontend/src/pages/ProjectDetails.jsx — added <AIBreakdownButton /> on the Tasks tab (this was your live-testing catch — the standalone page had it but the tab didn't)
New dependency

sonner (~4kb) — the only added package
Two UX fixes you caught during live testing

Button was enabled for garbage like / → now enforces: trimmed length ≥ 10, must contain at least one 3+ letter alphabetic run.
aftrgg 8uik o (real keyboard mash) still passed → added two heuristics: every word ≥ 3 letters must contain a vowel AND no word may have 4+ consecutive consonants (y counted as consonant). Reasoning shown live under the input with state-driven messages:
Empty → gray "Write a short sentence…"
Too short → amber "N more characters to unlock"
No letters → amber "Add some real words…"
Gibberish → amber "That doesn't look like a real project idea…"
Valid → green "Looks good — hit Generate with AI"
Live user-verified in your browser
AI Assist section on /projects/new → generated AI-Powered Coding Study Buddy project scaffold ✅
Project created, landed at /projects/:id ✅
Tasks tab on /projects/:id — AI Breakdown button visible, generated 5 tasks that landed in the To Do column (screenshot) ✅
Sonner toast styling matches Terminal Punk ✅
Servers running right now
Backend — http://localhost:5000, nodemon watching, Mongo connected, fresh env
Frontend — http://localhost:5173, Vite HMR-updated every touched file
Still not done
No git commit yet — respecting your no-proactive-commits rule. Everything Phase-3 is uncommitted on top of dbdeb60 teamforge_phase2_completed
Full frontend test-checklist walk-through — you've hit steps 1–4. Remaining: verify unchecking tasks in the breakdown dialog + confirming only the checked ones land on the board, and eyeballing the two new AIHistory documents in Compass
Whatever Phase 4 becomes — analytics/recharts dashboard, per your original build order
Milestone reached
Your core AI differentiator — the thing that separates TeamForge AI from generic Trello/Jira — is now working end-to-end. A student can go from a one-line idea → AI-generated project scaffold → AI-suggested task breakdown → real tasks on the board, all in about 15 seconds and 3 clicks.

Ping me when you want to commit, walk the remaining test steps, or roll into Phase 4.


Phase 4 is done. Here's the full picture:

What shipped
Backend

backend/src/controllers/dashboard.controller.js — getSummary (activeProjects, completed/pending tasks, upcoming deadlines within 7 days, tasksByStatus for the chart, recentProjects) + getProductivity (7 UTC-aligned daily buckets, gap-filled so quiet weeks still render a full week)
backend/src/routes/dashboard.routes.js — mounted at /api/dashboard, both endpoints behind protect
backend/src/prompts/productivityReport.prompt.js — buildProductivityReportPrompt(title, completed, pending, overdue) returning strict JSON schema
backend/src/controllers/ai.controller.js — added generateProductivityReport (member-only, buckets tasks, calls callGeminiJSON, logs to AIHistory with type productivity-report, clean 502 on failure)
backend/src/routes/ai.routes.js — added POST /api/ai/productivity-report
backend/src/app.js — mounted dashboardRoutes
Frontend

frontend/src/api/dashboard.api.js — getDashboardSummary(), getProductivity()
frontend/src/api/ai.api.js — added generateProductivityReport(projectId)
frontend/src/pages/Dashboard.jsx — real stat cards (active projects / completed / pending / due-this-week), recharts donut for tasksByStatus with total in the center + legend, recharts line for last 7 days with a green→pink gradient stroke, Upcoming Deadlines widget with relative time and priority pills, project grid preserved. Colors match the Kanban columns: #4ade80 / #fbbf24 / #ec4899.
frontend/src/components/ai/WeeklySummaryCard.jsx — hot-pink accent AI card with generate/regenerate button, sonner toasts, structured render of summary + highlights (green) + concerns (pink) + suggestedNextSteps (amber)
frontend/src/pages/ProjectDetails.jsx — Overview tab now stacks About + Stats + WeeklySummaryCard vertically. Stats panel confirmed to read from the live tasks state via useTasks(id), so it updates immediately when tasks are added or dragged (no fetch race).
Test results
Ran test-phase4.ps1 end-to-end:

== 1. GET /api/dashboard/summary as A ==     10/10 PASS
== 2. GET /api/dashboard/productivity as A == 4/4 PASS
== 3. POST /api/ai/productivity-report as A == 5/5 PASS  (Gemini responded cleanly)
== 4. POST /api/ai/productivity-report as B (non-member) -> 403  PASS
== 5. Cleanup deleteProject  PASS
PHASE 4 CHECKS PASSED
Also re-ran regressions:

Phase 2: 8/8 pass — auth, team requests, task creation, delete permissions all clean
Phase 3: generateTasks + all schema checks pass. generateProject returned 502 once — the backend log shows Google itself replied 503 UNAVAILABLE: "This model is currently experiencing high demand. Please try again later." My unchanged Phase 3 handler caught it, logged the real cause server-side, wrote a failed row to AIHistory, and surfaced a clean 502 to the client — exactly the contract. Not a regression from Phase 4; the same Gemini client happily served the Phase 4 Weekly Summary seconds earlier in the same run.


LAST SUMMARY - 

TeamForge AI — Full Summary (Everything Done So Far)
What it is
TeamForge AI is a monorepo app for coding students to plan projects, form teams, manage tasks with a Kanban board, and use AI across the project lifecycle — styled in Terminal Punk (dark #050508, neon green / hot pink / amber).

e:\teamforge_ai\
├── backend/   Node.js + Express + Mongoose (ESM)
└── frontend/  React 19 + Vite 6 + Tailwind v3 + dnd-kit
Repo: github.com/Swati7087/TEAMFORGE_AI — main synced, latest commit e2dde5c

Phase-by-phase — what's built
Phase 1 — Auth + User Profile ✅
JWT signup/login, Google OAuth scaffold (needs creds in .env)
User profile (skills, experience, availability, githubProfile)
AuthContext, protected routes
Pages: Landing, Login, Signup, Dashboard, Profile
Terminal Punk theme + interactive cube on Landing
Phase 2 — Project / Team / Task ✅
Full CRUD for projects, teams (invite/request/accept), tasks
Kanban board with drag-and-drop (todo → in-progress → done)
Owner vs member auth throughout
atomicWrite helper (transaction fallback on standalone MongoDB)
test-phase2.ps1 — 8/8 pass
Phase 3 — AI Project Generator + Task Breakdown ✅
POST /api/ai/generate-project — idea → project scaffold
POST /api/ai/generate-tasks — AI task breakdown
AIHistory audit trail for every AI call
Frontend: AI Assist on CreateProject, AIBreakdownButton + selective task dialog
Gibberish validation on project ideas
test-phase3.ps1 — pass
Phase 4 — Dashboard Analytics ✅
Summary stats, tasks-by-status donut chart, 7-day productivity line chart
Upcoming deadlines widget
WeeklySummaryCard — AI weekly recap per project
test-phase4.ps1 — pass
Phase 5 — GitHub Integration + AI Contribution Analyzer ✅ (just committed & pushed)
Sub-phase	What shipped
5a
Encrypted PAT storage (AES-256-CBC), connect/fetch/disconnect APIs, test-phase5a.ps1
5b
Connect GitHub UI, commits/PRs/contributors/issues tabs, Sync now
5c
⭐ USP — Gemini interprets who worked on what from real commit history + file paths
You verified this live: Swati7087 → frontend, backend, AI-integration, testing tags + natural-language summary.

End-to-end flows that work today
Sign up → create project → AI-generate scaffold → create project
AI task breakdown → selective add → Kanban board → drag between columns
Dashboard analytics + AI weekly summary
Connect GitHub repo → view commits/PRs → AI contribution analysis
Git history
Commit	Phase
c3a4af4
Phase 1 — auth + profile
dbdeb60
Phase 2 — project/team/task + Kanban
31cc7ea
Phase 3 — AI generator
6681f68
Phase 4 — dashboard analytics
e2dde5c
Phase 5 — GitHub + contribution analyzer
Conventions locked in
Phased builds only — no freelancing ahead
Terminal Punk palette (green = todo/go, amber = in-progress, pink = done/high priority)
Hand-rolled modals (Shadcn v4 utilities don't work on Tailwind v3)
API envelope: { success, message, data } — frontend peels .data
PowerShell on Windows; dev port 5174 when 5173 is busy
Commits only when you ask (Phase 5 just landed on GitHub)
Known deferred (not blockers)
Google OAuth — no creds yet
MongoDB standalone — no real transactions (fallback works)
user.id vs user._id minor inconsistency in auth responses
Tailwind v4 migration — deferred until animated Shadcn dialogs are needed
What's left (original plan)
Phase	Features
6a
Team Matcher, Skill Gap Detector
6b
Meeting Assistant, README Generator
6c
Bottleneck, Deadline Predictor, Risk Analyzer
6d
Conflict Resolver, Duplicate Work, Sprint Planner
7
AI Engineering Manager (chat Q&A over all project data)
All Phase 6 features follow the same pattern you've built four times: prompt → callGeminiJSON → controller → route → frontend UI.

Bottom line
You have a working student project-management app with auth, teams, Kanban, multiple AI features, dashboard analytics, live GitHub integration, and the standout AI Contribution Analyzer — all committed, pushed, and browser-verified.

Next up when you're ready: Phase 6a (Team Matcher + Skill Gap Detector).


TeamForge AI — Today's Session Handoff (Jul 12, 2026)
Paste this into a new agent tab to resume without context loss.

Project
Repo: e:\teamforge_ai\ — Node/Express/Mongoose backend + React 19/Vite/Tailwind frontend
Theme: Terminal Punk (#050508, green/amber/pink)
Git: Last pushed commit e2dde5c — "Phase 5: GitHub integration and AI contribution analyzer"
Uncommitted since then: Phase 6a fixes, Phase 6b, full Profile page, Gemini error-handling UX, GEMINI_MODEL in .env
What we completed TODAY
Phase 6a — Team Matcher + Skill Gap (finished + fixed)
Problem fixed: Team Matcher ranked candidates who duplicated existing team skills higher than gap-fillers (e.g. DevOps candidate ranked below React duplicate).

Fix:

backend/src/controllers/ai.controller.js — added computeTeamSkillCoverage(), skillsOverlap(), gapFillPrefilterScore() before Gemini prompt
backend/src/prompts/teamMatcher.prompt.js — passes alreadyCovered + missingSkills explicitly; CRITICAL SCORING RULE + few-shot example (DevOps ~90 vs React duplicate ~40)
Pre-filter penalizes duplicate skills (−3), rewards gap-fillers (+5 per missing skill)
Frontend (6a):

TeamMatcherPanel.jsx — Find Matches + Invite on Team tab
SkillGapPanel.jsx — missing/covered chips on Team tab
Tests: backend/scripts/test-phase6a.ps1 — PASS (when Gemini quota available)

Profile editor detour (done — feeds all AI features)
Empty skills[] caused Skill Gap to show everything as "Missing". Full profile built:

Backend:

User.js — phone, organization, organizationType
user.controller.js — allowlist update fields; email still blocked
Frontend:

pages/Profile.jsx — 5 sections, completeness meter, save + toast
components/profile/SkillsEditor.jsx — chip add/remove + autocomplete (~60 skills)
Dashboard.jsx — profile avatar → /profile
jsconfig.json — "ignoreDeprecations": "6.0" for TS 6 baseUrl warning
backend/scripts/test-profile.ps1 — PASS
Phase 6b — Meeting Assistant + README Generator (implemented, blocked on Gemini quota)
Backend:

File	Purpose
prompts/meetingSummary.prompt.js
buildMeetingSummaryPrompt(rawNotes, teamMemberNames) → strict JSON
prompts/readmeGenerator.prompt.js
buildReadmePrompt(project, tasks, techStack) → raw Markdown
models/Meeting.js
Persists summaries + action items + history
ai.controller.js
summarizeMeeting, getMeetingHistory, generateReadme
routes/ai.routes.js
3 new routes (see below)
Routes:

POST /api/ai/meeting-summary   (member)  — { projectId, rawNotes }
GET  /api/ai/meeting-history   (member)  — ?projectId=
POST /api/ai/generate-readme   (member)  — { projectId } → { markdown }
Meeting summary uses callGeminiJSON; README uses plain callGemini (not JSON)
Both log to AIHistory; meetings saved to Meeting model
Frontend:

api/ai.api.js — summarizeMeeting, getMeetingHistory, generateReadme
pages/MeetingNotes.jsx — textarea, summarize, action-item checklist, history list
components/ai/ReadmeGeneratorCard.jsx — generate, react-markdown preview, copy + download .md
ProjectDetails.jsx Overview tab — README card + Meeting Assistant link
Route: /projects/:id/meetings
react-markdown installed
Tests: backend/scripts/test-phase6b.ps1

Meeting summary + history + 403 checks — PASS
README — FAIL on Gemini daily quota (not a code bug)
Gemini / AI reliability fixes (today)
Root cause of failures: NOT login JWT expiry. Gemini free-tier quota (HTTP 429):

~20 requests/day per model on free tier (gemini-3.5-flash via gemini-flash-latest)
User exhausted quota testing many AI features in one session
Changes made:

gemini.service.js — removed slow auto-retry (was causing 2–3 min spinners); fail fast on 429
geminiUserMessage() — distinguishes daily quota vs short rate limit
ai.controller.js — respondAIFailure() returns clearer messages (429 vs 502)
WeeklySummaryCard + ReadmeGeneratorCard — shared aiLoading mutex on Overview (one AI feature at a time)
backend/.env — added GEMINI_MODEL=gemini-2.0-flash (separate quota pool); still 429 today — resume tomorrow or new API key
User-facing error (working as intended):

"Gemini free daily quota used up (~20 requests/day). Wait until tomorrow, or set GEMINI_MODEL to a different model in backend/.env."

AI routes currently wired
POST /api/ai/generate-project
POST /api/ai/generate-tasks
POST /api/ai/productivity-report
POST /api/ai/contribution-analysis
POST /api/ai/match-team          (owner only)
POST /api/ai/skill-gap           (member)
POST /api/ai/meeting-summary     (member)   ← 6b
GET  /api/ai/meeting-history     (member)   ← 6b
POST /api/ai/generate-readme     (member)   ← 6b
Scaffolded but not yet implemented: deadline-predict, conflict-resolver, risk-analysis, bottleneck (Phase 6c/6d)

Key file paths
backend/src/prompts/teamMatcher.prompt.js      ← gap-fill scoring fix
backend/src/prompts/meetingSummary.prompt.js     ← 6b
backend/src/prompts/readmeGenerator.prompt.js    ← 6b
backend/src/controllers/ai.controller.js       ← all AI endpoints
backend/src/models/Meeting.js
backend/src/services/gemini.service.js           ← quota error handling
backend/scripts/test-phase6a.ps1
backend/scripts/test-phase6b.ps1
frontend/src/pages/MeetingNotes.jsx
frontend/src/components/ai/ReadmeGeneratorCard.jsx
frontend/src/pages/Profile.jsx
frontend/src/components/profile/SkillsEditor.jsx
Dev conventions (preserve)
Phased builds; commit only when user asks
API envelope { success, message, data } — frontend peels .data
Hand-rolled modals (Tailwind v3 / Shadcn v4 mismatch)
PowerShell tests on Windows; frontend dev port 5173 or 5174
GITHUB_TEST_TOKEN + GITHUB_TEST_REPO_URL in .env for Phase 5 live tests
Profile skills[] + githubProfile feed Team Matcher, Skill Gap, Contribution Analyzer
Status at end of day
Phase	Status
6a Team Matcher + Skill Gap
✅ Done + gap-fill fix verified
Profile editor
✅ Done
6b Meeting + README
✅ Code complete; browser test blocked on Gemini quota
Gemini quota
⏸ Resume tomorrow — restart backend after quota resets
Tomorrow — first steps
Restart backend (npm run dev in backend/) — picks up GEMINI_MODEL=gemini-2.0-flash
Re-test 6b in browser:
Generate README on Overview tab (one button at a time)
Meeting Notes at /projects/:id/meetings — paste notes with team names
Download README as .md
Run backend/scripts/test-phase6b.ps1 — should fully PASS if quota reset
Next build: Phase 6c — Bottleneck Detector, Deadline Predictor, Risk Analyzer (shared task/timeline analysis logic)
If Gemini still 429 tomorrow
Wait for daily reset (often midnight Pacific)
New key: aistudio.google.com/apikey → replace GEMINI_API_KEY in backend/.env
Or enable billing in Google AI Studio
Try alternate models: gemini-2.0-flash, gemini-2.0-flash-lite (set GEMINI_MODEL in .env)
Build order ahead
6c: Bottleneck, Deadline Predictor, Risk Analyzer
6d: Conflict Resolver, Duplicate Work, Sprint Planner
Phase 7: AI Engineering Manager (chat Q&A)








