# Monorepo scaffold (pnpm + 2 Express apps + Vue admin)

- **Date:** 2026-10-28 · **Status:** done (first pass) · **Branch:** main (uncommitted)

## Outcome
- pnpm workspace: `apps/api`, `apps/admin`, `apps/admin-web` (Vue 3), `packages/shared|core|pipeline`.
- One pull abstraction (`Source`) with a generic runner: schema validation, row-count guard, atomic write with backup.
- Sources ported: `curricunet-courses` (full legacy `courses.json` shape), `airtable-departments`.
- Admin UI: run pulls and watch progress; API explorer for testing the public API.
- `/start-work` and `/finish-work` skills; this knowledge folder.

## Decisions
- **Keep the legacy course shape** so explore front-end/programs consumers can switch over without changes.
- **Store behind an interface** (`DatasetStore`): FileStore for local dev, Postgres planned for Heroku,
  since the two apps can't share a dyno filesystem.
- **Runs are async with polling** (`POST /sources/:id/runs` → 202, `GET /runs/:id`), so a long Curricunet pull
  never hits Heroku's 30s request timeout.
- **Placeholder auth:** a shared `ADMIN_TOKEN` bearer token. Replace before real use (SSO / sessions).
- **Not ported yet:** programs, transfers, O*NET, CareerOneStop, Datamuse, images, sitemaps.

## Gotchas
- Local machine had Node 22.11; current tsup / sanitize-html / vitest 5 need 22.12+ (`require(esm)`).
- `pnpm add -D typescript` pulled TS 7 (native Go port), and vue-tsc can't load it → pinned 6.x with an override.
- Legacy `courses.json` validation found blank `""` for fees and `creditsMax` in ~300 rows; the schema allows it.
- The legacy repo's `CurricunetService.js` currently points at the vendor **dev** host (`mwsdev.…`); here it's `CURRIC_HOST`.

## Follow-ups
- [ ] Upgrade local Node to latest 22.x (or 24 LTS) and drop the `--experimental-require-module` workaround.
- [ ] Do a real Curricunet pull against the dev host and compare output to legacy `courses.json` (diff tool).
- [ ] `PgDatasetStore` + Heroku Postgres; persist run history.
- [ ] Port the programs pull (depends on courses) and Airtable side-loads (programs extra, transfers, schools).
- [ ] Real admin auth.
- [ ] Create Heroku pipeline(s) per [docs/heroku.md](../../heroku.md).
