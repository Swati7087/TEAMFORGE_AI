# TeamForge AI

Monorepo containing the TeamForge AI backend (Express + MongoDB) and frontend (React + Vite + Tailwind + Shadcn).

## Structure

```
teamforge-ai/
├── backend/      Express API, MongoDB models, Gemini + GitHub integrations
├── frontend/     React app (Vite), Tailwind, Shadcn UI, Recharts
├── .gitignore
└── README.md
```

Each app is a separate npm project — no shared root `package.json`. This keeps deploys to Render / Vercel simple.

## Getting started

### Backend

```bash
cd backend
cp .env.example .env    # then fill in real values
npm install
npm run dev             # nodemon src/server.js
```

### Frontend

```bash
cd frontend
npm install
npm run dev             # vite (defaults to http://localhost:5173)
```

## Environment

- Backend runs on `PORT=5000` by default.
- Frontend expects `VITE_API_URL=http://localhost:5000`.
- See `backend/.env.example` for the full list of required backend env vars.

## Shadcn UI

Shadcn is set up on demand — the frontend is pre-configured with the `@/` alias and Tailwind, so you can run:

```bash
cd frontend
npx shadcn@latest init         # one-time, pick your style/base color
npx shadcn@latest add button   # add components as needed
```
