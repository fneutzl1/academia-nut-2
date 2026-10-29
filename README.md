# Academia Nut

Data pulling and serving for Columbus State's Explore catalog.

| Workspace | What it is |
| --- | --- |
| `apps/api` | Public read-only JSON API |
| `apps/admin` | Admin server: runs data pulls, serves the admin UI |
| `apps/admin-web` | Vue 3 admin UI: run pulls, explore the API |
| `packages/shared` | Shared types + zod schemas (browser-safe) |
| `packages/core` | Env + dataset storage (Node) |
| `packages/pipeline` | Source/connector/runner pipeline for all data pulls |

## Getting started

```sh
corepack enable          # provides pnpm 10 from package.json
pnpm install
cp .env.example .env     # fill in ADMIN_TOKEN and vendor credentials
pnpm dev                 # api :4000 · admin :4001 · UI http://localhost:5173
```

Requires Node 22.12 or newer (see `.nvmrc`).

Open the UI, paste your `ADMIN_TOKEN` into the token box, and run a pull from **Sources**.
Use **API Explorer** to hit the public API.

## How a data pull works

Every pull, whatever the service, is a `Source`:

```ts
export const airtableDepartments = defineSource({
  id: 'airtable-departments',
  service: 'airtable',
  dataset: 'departments',
  fetch: () => airtablePages(BASE_ID, 'Department'),   // connector: paging + auth
  transform: ({ id, fields }) => ({ id, name: fields.Name, ... }),
  schema: DepartmentSchema,                            // every row validated before write
  guard: { maxCountChange: 0.25 },                     // refuse suspicious row-count swings
});
```

`runSource()` fetches all pages, transforms, validates, checks guards, then atomically replaces
the dataset (keeping a backup). If anything fails, the previous data stays live.

See [docs/heroku.md](docs/heroku.md) for deployment.
