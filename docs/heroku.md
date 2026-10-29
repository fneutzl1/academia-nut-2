# Heroku deployment plan

Status: **plan, not yet set up.** The repo already builds and starts the way Heroku expects.

## Shape

One repo → four Heroku apps in two pipelines:

| Pipeline | test (staging) | prod |
| --- | --- | --- |
| `academia-nut-api` | `an-api-test` | `an-api-prod` |
| `academia-nut-admin` | `an-admin-test` | `an-admin-prod` |

- Deploy `main` to the **test** apps (GitHub integration, auto-deploy after CI passes).
- **Promote** test → prod in the pipeline. Promotion copies the built slug, so nothing environment-specific
  may be baked in at build time. That's why the admin UI reads `PUBLIC_API_URL` from `/admin-api/config`
  at runtime.
- Optional later: review apps for PRs.

## How a dyno starts

- The Node buildpack sees `packageManager: pnpm@…` and installs with pnpm, then runs the root `build`
  script (builds all apps), then prunes dev dependencies.
- `Procfile`: `web: pnpm start` → `pnpm --filter "@academia-nut/${APP_NAME}" start`.
- Set config var **`APP_NAME=api`** or **`APP_NAME=admin`** on each app.

## Config vars

| Var | api | admin | Notes |
| --- | --- | --- | --- |
| `APP_NAME` | `api` | `admin` | picks the app |
| `NODE_ENV` | `production` | `production` | |
| `CORS_ORIGINS` | ✓ | | Explore front-end origin(s) **and** the admin app URL (for API Explorer) |
| `ADMIN_TOKEN` | | ✓ | placeholder auth; replace with real auth |
| `PUBLIC_API_URL` | | ✓ | e.g. `https://an-api-test.herokuapp.com` |
| `CURRIC_USER` / `CURRIC_PASS` / `CURRIC_HOST` | | ✓ | test → vendor dev host, prod → `mws.services.curriqunet.com` |
| `AIRTABLE_TOKEN` | | ✓ | |
| `DATABASE_URL` | ✓ | ✓ | once the Postgres store exists (same DB attached to both apps in an env) |

## Storage (must happen before the first real deploy)

Dyno filesystems are ephemeral (wiped on each deploy/restart, ~daily) and **not shared** between the api and
admin apps. `FileStore` is for local dev only.

Next step: a `PgDatasetStore` implementing `DatasetStore` in `packages/core`:

- `datasets(name pk, rows jsonb, row_count, updated_at, source_id)`: admin writes, api reads.
- `dataset_versions(...)`: last N versions per dataset, replacing file backups (restore = copy a row back).
- `runs(...)`: persist run history (today it's in memory on the admin dyno).
- One Heroku Postgres per environment, attached to both apps in that environment
  (`heroku addons:attach <db> -a an-api-test`).
- The api keeps an in-memory cache keyed by `updated_at` so reads stay fast.

## Scheduled pulls

- Heroku Scheduler on the admin app: `pnpm --filter @academia-nut/admin pull all` (non-zero exit on failure).
- Runs triggered from the UI run inside the web dyno. They're async, so request timeouts don't matter,
  but a dyno restart kills an in-flight run. If that becomes a problem, move runs to a `worker` process
  fed by a jobs table.

## Before go-live checklist

- [ ] Postgres store + migration
- [ ] Real admin auth (replace `ADMIN_TOKEN`)
- [ ] CI: `pnpm typecheck && pnpm test` on PRs (GitHub Actions), gate auto-deploy on it
- [ ] Failure alerting for pulls (email/Slack on `failed` runs)
- [ ] Explore front end pointed at `an-api-test`, then prod
