# Academia Nut

Pulls Columbus State course/program data from vendor services (Curricunet first, Airtable and others
side-loaded), massages it into simple tables, and serves it read-only to the Explore front end and others.
Successor to `explore-api-original` (legacy Express app that writes JSON files).

## Layout (pnpm workspace)
- `apps/api`: public, read-only Express API (`/api/datasets`, `/api/datasets/:name`, `/api/courses/:id`, year-versioned `/api/catalog/*` from Postgres).
- `apps/admin`: Express admin server: lists/runs data pulls (`/admin-api/*`), serves the built admin UI. `src/cli.ts` runs pulls headless.
- `apps/admin-web`: Vue 3 + Vite admin UI (Sources, Catalog browser, API Explorer). Dev proxy to both servers.
- `packages/shared`: browser-safe zod schemas + types (dataset rows, run DTOs).
- `packages/core`: Node-only: env loading, `DatasetStore` interface + `FileStore`.
- `packages/db`: Node-only Prisma (Postgres): catalog-year tables (courses, departments, subjects), `writeCourseYear` & co.
- `packages/pipeline`: `Source` abstraction, `runSource` runner, connectors (Curricunet, Airtable, HTTP), sources.

## Commands
- `pnpm dev`: all three apps (api :4000, admin :4001, admin-web :5173). Needs a root `.env` (see `.env.example`).
- `pnpm test` / `pnpm typecheck` / `pnpm build`: all workspaces.
- `pnpm --filter @academia-nut/admin pull:dev <source-id|all>`: run a pull from the CLI.
- `docker compose up -d`: local Postgres. `pnpm db:migrate` (new migration), `pnpm db:studio`, `pnpm --filter @academia-nut/db backfill:legacy`.
- Requires Node >= 22.12 (dev uses 26) and pnpm 12.

## Conventions
- New data pull = new file in `packages/pipeline/src/sources/` + register in `sources/index.ts` + fixture test.
- Dataset schemas live in `packages/shared/src/datasets/`. Don't break the legacy `courses.json` shape.
- TypeScript strict, ESM, `.js` suffix on relative imports. Tests are vitest, colocated or in `__tests__/`.
- Deployment target: Heroku, separate test & prod apps; see [docs/heroku.md](docs/heroku.md).

## Working sessions
- `/start-work <prompt>`: creates a git-ignored `.work/<date>-<slug>/plan.md` + `progress.md`. Keep them updated while working.
- `/finish-work`: closes the workstream and promotes durable knowledge into `docs/knowledge/`.

## Durable knowledge
@docs/knowledge/patterns.md
