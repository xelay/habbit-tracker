# AGENTS.md — Habbit Tracker

This file provides a structured overview of the project for AI coding agents (e.g., OpenHands, Copilot, Cursor, Perplexity).

---

## Project Overview

**Habbit Tracker** is a Progressive Web App (PWA) for tracking beneficial and harmful habits.  
It runs fully client-side (localStorage-based), with a lightweight Express backend primarily serving the static bundle.

---

## Tech Stack

| Layer      | Technology                                      |
|------------|-------------------------------------------------|
| Frontend   | React 18, TypeScript, Vite, TailwindCSS, shadcn/ui |
| Routing    | Wouter (hash-based: `useHashLocation`)          |
| Backend    | Node.js, Express (static serving + API stub)    |
| Database   | SQLite via `better-sqlite3` + Drizzle ORM       |
| Schema     | Drizzle + Zod validation (`drizzle-zod`)        |
| Build      | Vite (client), tsx/esbuild (server)             |
| PWA        | Web Push notifications, Service Worker          |

---

## Repository Structure

```
habbit-tracker/
├── client/
│   ├── index.html          # PWA entry point (manifest, SW registration)
│   ├── public/             # Static assets (icons, manifest.json)
│   └── src/
│       ├── main.tsx        # React root mount
│       ├── App.tsx         # Router + theme init + sync on app start
│       ├── index.css       # Tailwind base styles + CSS variables (themes)
│       ├── pages/
│       │   ├── Home.tsx        # Main dashboard: today's habits, check-in
│       │   ├── Settings.tsx    # Habit management, push settings, theme, sync
│       │   ├── Statistics.tsx  # Weekly/monthly stats, streaks, charts
│       │   ├── Log.tsx         # Daily log history
│       │   └── not-found.tsx   # 404 page
│       ├── components/
│       │   └── ui/             # shadcn/ui components (Button, Toast, etc.)
│       ├── hooks/              # Custom React hooks
│       └── lib/
│           ├── habits.ts       # Core habit logic, localStorage CRUD, weekly stats
│           ├── push.ts         # Web Push notification logic
│           ├── sync.ts         # Gyxi sync integration
│           └── theme.ts        # Theme management (light/dark/system)
├── server/
│   ├── index.ts            # Express app bootstrap, logging middleware, port 5000
│   ├── routes.ts           # API route registration (stub, prefix /api)
│   ├── storage.ts          # DatabaseStorage: User CRUD via Drizzle + SQLite
│   ├── static.ts           # Serves built client in production
│   └── vite.ts             # Vite dev server middleware (development only)
├── shared/
│   └── schema.ts           # Drizzle schema: `users` table; Zod insert types
├── script/                 # Utility scripts
├── drizzle.config.ts       # Drizzle Kit config (SQLite, migrations path)
├── vite.config.ts          # Vite config: React plugin, path aliases (@/ → client/src)
├── tailwind.config.ts      # Tailwind config with custom theme/colors
├── components.json         # shadcn/ui config
├── tsconfig.json           # TypeScript paths: @shared/* → shared/*
└── package.json            # Monorepo scripts: dev, build, start, db:push
```

---

## Key Application Logic

### Habits (client-side)
- All habit data is stored in **localStorage** — no backend API calls for habits.
- `lib/habits.ts` provides CRUD for habits and computes `getWeeklyStats()` (beneficial, harmful, streak).
- Habits are categorized as **beneficial** (positive goals) or **harmful** (bad habits to reduce).

### Pages & Navigation
- Hash-based routing (`/#/`, `/#/settings`, `/#/statistics`, `/#/log`).
- **Home** — daily habit check-in dashboard.
- **Settings** — add/edit/delete habits, configure push notifications, choose theme, sync.
- **Statistics** — charts and streaks over time.
- **Log** — historical view of completed days.

### Theme System
- Supports `light`, `dark`, `system` themes.
- Applied on app mount via `lib/theme.ts`; listens to `prefers-color-scheme` changes.
- CSS variables defined in `index.css`.

### PWA & Push
- Web Push notifications triggered weekly based on stats (`lib/push.ts`).
- Sync with external service **Gyxi** (`lib/sync.ts`) — runs on app start and on visibility change (PWA mode only).

### Backend / Server
- Express server on **port 5000** (env `PORT`).
- In **development**: Vite middleware (`server/vite.ts`) serves HMR.
- In **production**: serves built `dist/public` as static files (`server/static.ts`).
- `server/routes.ts` is a stub — all `/api` routes to be implemented here.
- `server/storage.ts` has a `DatabaseStorage` class for `users` table (register/auth flows).
- DB file: `data.db` (SQLite, WAL mode).

---

## Development Commands

```bash
npm run dev        # Start dev server (Vite HMR + Express on :5000)
npm run build      # Build client (Vite) + server (esbuild)
npm run start      # Run production server
npm run db:push    # Apply Drizzle schema to SQLite (data.db)
```

---

## Environment Variables

| Variable   | Default | Description              |
|------------|---------|--------------------------|
| `PORT`     | `5000`  | HTTP server port         |
| `NODE_ENV` | —       | `production` or `development` |

---

## Agent Guidelines

- **Do not modify** `shared/schema.ts` without running `npm run db:push` afterward.
- **Frontend state** (habits) lives in localStorage — no REST API needed for habit CRUD.
- **New API endpoints** go into `server/routes.ts` using the `/api` prefix.
- **New pages** go into `client/src/pages/` and must be registered in `client/src/App.tsx`.
- **New UI components** use shadcn/ui (`components.json` config) — run `npx shadcn add <component>`.
- **Path alias** `@/` maps to `client/src/` — use it for all client imports.
- **Shared types** live in `shared/schema.ts` — importable via `@shared/schema`.
- When adding push notification logic, work inside `client/src/lib/push.ts`.
- When adding sync logic, work inside `client/src/lib/sync.ts`.
