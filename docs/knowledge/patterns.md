# Patterns & gotchas

Curated, durable knowledge for anyone (human or AI) working in this repo.
Imported by `CLAUDE.md`, so keep it short. Maintained by `/finish-work`;
details live in [workstreams/](workstreams/).

## Data pulls
- Every pull is a `Source` in `packages/pipeline/src/sources/` (fetch pages → transform → finalize → schema → guard),
  registered in `sources/index.ts`. Don't write one-off pull scripts; add a source.
- Connectors own paging and auth (`curricunetPages`, `airtablePages`, `getJson`). Transforms stay pure, so they're testable with fixtures.
- Curricunet: read fields **by `sectionName` / `displayName`**, never by position. Pass aliases for known renames
  (`field(s, 'Catalog Implement Date', 'Implement Date')`).
- Cross-row work (e.g. requisite slugs) goes in `finalize()` using the *current run's* rows, never a previously written file.
- Missing vendor sections → `ctx.warn(...)` and safe defaults; only throw for whole-run failures.

## Data shape compatibility
- `CourseSchema` mirrors the legacy `courses.json` exactly. Downstream consumers depend on it, so don't reshape it.
- Legacy keeps blank vendor numbers as `""` (e.g. `creditsMax: ""` = fixed credits). Use `numOrBlank`, not `num`.
- `slug` / `subjectSlug` are **not** in `courses.json`; the legacy API layer adds them from `subjects.json`.
- Validate schema changes against real data: run all legacy `courses.json` rows through `CourseSchema.safeParse`.

## Workspace & tooling
- Node **>= 22.12** is required (tsup, sanitize-html deps need unflagged `require(esm)`).
- TypeScript is pinned to 6.x via `overrides`: TS 7 (native) has no JS API, and `vue-tsc` breaks.
- Workspace packages export TypeScript source; apps bundle them with tsup (`noExternal: [/^@academia-nut\//]`).
  Admin's bundle inlines CommonJS deps, so it carries a `createRequire` banner.
- `packages/shared` must stay browser-safe (zod + types only); Node code goes in `packages/core`.
- pnpm 10 blocks dependency install scripts: allow-list in `pnpm-workspace.yaml` → `onlyBuiltDependencies`.

## Heroku
- One repo, separate Heroku apps; `APP_NAME` picks which app the Procfile starts.
- UI config is fetched at runtime (`/admin-api/config`), never baked into the Vite build: pipeline promotion
  copies the *same slug* from test to prod.
- Dyno disks are ephemeral and not shared between apps: `FileStore` is local-dev only. Prod needs a Postgres `DatasetStore`.
