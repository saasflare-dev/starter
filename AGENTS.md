# Saasflare Starter

Monorepo: pnpm workspaces · Hono backend · oRPC + TanStack Query · Tailwind V4 + Shadcn/ui · Cloudflare Workers

## Active Stack

```
FRONTEND=web
DATABASE=d1
```

## Project Structure

```
apps/
  server/     Hono backend (port 4000)
  web/        TanStack Start frontend (port 3000)
  tauri/      Tauri 2.0 desktop template (tray, autostart, updater, oRPC playground)
packages/
  api/        oRPC API definitions + Zod schemas
  db/         Drizzle schema + migrations
  ui/         Shadcn UI components (do not modify)
  config/     Shared TS configs
```

## Quick Commands

```bash
pnpm dev                   # server + web
pnpm typecheck             # tsc --noEmit across all workspaces
pnpm test                  # vitest (server integration tests)
pnpm test:e2e              # playwright E2E (auto-starts dev server)
pnpm lint                  # biome lint
pnpm format                # biome check --write . (lint + format + import-sort)
pnpm ci                    # biome ci (read-only, used in CI)
```

## Documentation

Read these docs based on the task at hand:

| When | Read |
|------|------|
| Adding/modifying API endpoints | [docs/api-development.md](docs/api-development.md) |
| Modifying database schema | [docs/database-d1.md](docs/database-d1.md) |
| Inspecting D1 data (ad-hoc SQL: "how many users", "show me row 5", etc.) | [docs/db-query.md](docs/db-query.md) |
| Using UI components or styling | [docs/ui-guidelines.md](docs/ui-guidelines.md) |
| Code style, TypeScript rules | [docs/coding-standards.md](docs/coding-standards.md) |
| Env vars, deployment config | [docs/environment.md](docs/environment.md) |
| **Frontend: TanStack Start** | [docs/rules-tanstack.md](docs/rules-tanstack.md) |
| Building a desktop app (Tauri) | [docs/desktop-tauri.md](docs/desktop-tauri.md) |
| Writing or running tests | [docs/testing.md](docs/testing.md) |
| Debugging UI issues | [docs/debugging.md](docs/debugging.md) |
| Deploying, first-time setup, or CI | [docs/deploy.md](docs/deploy.md) |

**Always read the frontend rules file before writing frontend code.**

## Looking Up Library Documentation

Use `pnpm ctx7` CLI (installed as devDependency) to query up-to-date documentation for any library:

```bash
pnpm ctx7 library <name> "<query>"       # Find library ID
pnpm ctx7 docs <libraryId> "<query>"     # Query documentation
```
