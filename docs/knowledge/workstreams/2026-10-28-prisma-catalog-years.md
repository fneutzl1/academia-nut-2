# Prisma + year-versioned courses & departments

- **Date:** 2026-10-28 · **Status:** done (first pass) · **Branch:** prisma

## Outcome
- [`packages/db`](../../../packages/db/): Prisma 7 on Postgres (Docker locally, Heroku Postgres later).
  Tables: `CatalogYear`, `Course` + `CourseIdentifier` + `CourseVersion`, the same trio for departments,
  `Subject` + `SubjectVersion`, and an append-only `ChangeLog`. See [schema.prisma](../../../packages/db/prisma/schema.prisma).
- Legacy backfill (`pnpm --filter @academia-nut/db backfill:legacy`): 2022-23 to 2025-26 imported and COMPLETE,
  live legacy files seeded the OPEN year 2026-27. Every year reads back deep-equal to its source JSON.
- Pulls dual-write: `Source.catalog` + `runSource(..., { catalog })` writes the newest OPEN year after the JSON dataset is written.
- Public API `/api/catalog/*` (years, courses per year, one course per year in legacy shape, one course across years,
  departments per year); admin-only `/admin-api/catalog/courses/:id/changes`. The admin UI's **Catalog** page reads both.

## Decisions
- **One version row per entity per catalog year** (not one row per change with from/to years): freezing a year and
  querying a year stay trivial. `contentHash` skips no-op writes and lets the UI show "unchanged since…".
- **Persistent identity separate from vendor keys.** `Course` holds only a uuid; course codes and Curricunet
  entityIds live in `CourseIdentifier`, so a renumbered course keeps its id. Resolution: entityId first, then code;
  on conflict the code wins and a warning is recorded.
- **Years complete by a person, not a date.** `completeCatalogYear()` freezes a year; writes to it then throw.
  Pulls target the newest OPEN year.
- **Built to become a system of record:** `origin` (IMPORT | PULL | MANUAL), `updatedBy`, `sourceRunId` on every
  version, and ChangeLog before/after. Pulls never remove MANUAL rows.
- **2021-2022 not imported**: older flat course shape (`pre-req`, `dept-fee`, …).
- **Read path is the public API**, not admin routes, per the user ("ultimately use the api app to present the data").
  Change history (before/after) stays admin-only.
- Legacy rows without a `syllabus` key come back as `syllabus: null` (Prisma can't tell DB NULL from JSON null on read).

## Gotchas
- Prisma 7: needs a driver adapter (`@prisma/adapter-pg`), doesn't read `.env` (our `prisma.config.ts` loads the root one),
  and **refuses `migrate reset` from an AI agent** without explicit user consent. Tests use `migrate deploy` + TRUNCATE on a `*_test` DB.
- npm's `latest` tag for prisma pointed at an 8.0 RC; pin the newest stable instead.
- pnpm 12: new store (clean reinstall), `minimumReleaseAge` rejects packages published within the last day (it also
  auto-adds excludes; we removed them), and `onlyBuiltDependencies` is ignored. Use the `allowBuilds:` map.
- vitest 5 + vite 8 crash (`code.charCodeAt is not a function`) while printing a globalSetup error. Run the setup command by hand.
- `.env` `CURRIC_HOST` is the vendor **dev** host. A pull from it overwrote 2026-27 courses with dev data
  (syllabus null on ~1,060 rows, placeholder beginDate 2016-06-01). ChangeLog kept the previous values.

## Follow-ups
- [ ] Restore 2026-27 courses: prod-host pull (`mws.services.curriqunet.com`) or rerun the backfill.
- [ ] Admin: create the next catalog year, "complete year" button.
- [ ] Find out if Curricunet entityId is stable across course revisions (decides how much to trust it for identity).
- [ ] Programs on the same Entity / Identifier / Version pattern.
- [ ] Switch consumers from `/api/datasets/courses` to `/api/catalog/...` once dual-write is trusted; then a Pg `DatasetStore` for the rest.
