# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Project

Eventide: an event ticketing website built as a Bun-workspace monorepo of microservices. Stack: React + TanStack Router (web), ElysiaJS (services), Drizzle + Postgres (data), S3 (files). User-facing copy is in Thai.

### Roles

- **user**: enroll in a ticket, view own tickets, manage own profile, apply to become an organizer
- **organizer**: create events, ticket types and enrollment forms; add team members; check in tickets; view the event dashboard; manage **only their own** events
- **admin**: manage all events, suspend accounts, manage other accounts, approve organizer applications (user → organizer)

### Auth and email

- **Auth:** `apps/auth` runs Better Auth (load the `better-auth-*` skills before changing it).
  - Login is email/password, plus Google, which is enabled only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set.
  - The admin plugin stores the role (`user` / `organizer` / `admin`, defined in `src/libs/permissions.ts`) on `users.role`. Suspending an account is the admin plugin's **ban**. Approving an organizer application is **set-role**.
- **Email:** nothing sends mail inline. Producers call `enqueueMail()` from `@app/mail`, which puts a message on the SQS `mail-queue`. `apps/mail-worker` consumes the queue and sends with **Nodemailer over Gmail SMTP**.
  - A message is deleted only after it sends. Failures are retried and land in `mail-dlq` after 5 receives.
  - Without `GMAIL_USER` / `GMAIL_APP_PASSWORD`, the worker runs dry and logs the rendered mail instead of sending it.

## Commands

Use Bun for everything: `bun install`, `bun run <script>`, `bunx <pkg>`, `bun test`. Run these from the repo root unless noted.

```sh
cp .env.example .env          # one-time; every workspace reads the ROOT .env
bun run infra:up              # start docker-compose services (infra:down to stop, infra:reset wipes volumes)
bun run dev                   # every apps/* dev script in parallel (web, all services, mail worker)
bun run --filter @app/event dev   # one workspace only

bun run db:generate           # generate SQL migration from schema changes -> packages/db/drizzle/
bun run db:migrate            # apply migrations
bun run db:studio             # Drizzle Studio

bun run --filter @app/web lint    # oxlint (web only, no lint config elsewhere)
bun run --filter @app/web build   # tsc -b && vite build
```

**Type checking:** run `bun check` from **inside** a workspace (`cd apps/web && bun check`; `cd apps/event && bun check src/index.ts`). The root `bun run typecheck` reads the root tsconfig, which has no DOM lib and no `@/*` alias, so it reports false errors in `apps/web`.

**Tests:** there are none yet. Use `bun test` (`import { test, expect } from "bun:test"`). For a single file use `bun test test/event.test.ts`, and for a single test use `bun test -t "pattern"`.

**shadcn CLI:** `components.json` lives in `apps/web`, so run `cd apps/web && bunx shadcn@latest add <component>`. The shadcn MCP server is configured in `.mcp.json`.

## Local infrastructure (`docker-compose.yml`)

| Service | Port(s) | Notes |
|---|---|---|
| Postgres 18 | 5432 | `DATABASE_URL` |
| Redis 8 | 6379 | `REDIS_URL` (the default env var for Bun's `redis` client) |
| ElasticMQ (SQS) | 9324 API, 9325 UI | queues defined in `infra/elasticmq/elasticmq.conf` |
| MinIO (S3) | 9000 API, 9001 console | `minio-init` creates the `event-assets` bucket |

- **Queues:** `mail-queue` has a 30s visibility timeout and a 10s long poll. After 5 receives a message moves to `mail-dlq`. A new queue must be added to `elasticmq.conf` and get its URL variable in `.env.example`.
- **S3:** the `S3_*` variables in `.env.example` are the ones Bun's built-in `s3` client reads by default, so `import { s3 } from "bun"` works without config.
- **Env loading:** workspace scripts run from the package directory, so each one passes `--env-file=../../.env`. Keep doing that in new packages.

## Architecture

### Workspaces

- `apps/web` (`@app/web`): Vite + React 19 SPA on :5173. Uses TanStack Router (file-based), TanStack Query and shadcn/ui.
- One Elysia service per domain, each with its own process, port and path prefix:

  | Workspace | Port | Prefix | Owns |
  |---|---|---|---|
  | `apps/auth` | 3001 | `/api/auth` | Better Auth: accounts, sessions, roles, bans |
  | `apps/event` | 3002 | `/api/events` | events, ticket types, enrollment forms |
  | `apps/registration` | 3003 | `/api/regis` | enrollments, tickets, check-in |
  | `apps/payment` | 3004 | `/api/payment` | Stripe payments, billing, refund log |

- `apps/mail-worker`: an SQS consumer with no HTTP server. It sends queued mail through Gmail.
- `packages/db` (`@app/db`): the Drizzle schema and client that every service shares.
- `packages/mail` (`@app/mail`): the mail queue contract. It holds the `MailMessage` type, the shared `sqs` client, `enqueueMail()` for producers and `parseMailMessage()` for the worker.
- `services/*` is declared as a workspace glob but is unused. Root `bun run dev` only starts `apps/*`.

The generic Bun advice doesn't fully apply here. The web app **does** use Vite (not Bun HTML imports), and the DB layer uses Drizzle on the **postgres.js** driver (not `Bun.sql`). Elsewhere in services, prefer Bun built-ins (`Bun.redis`, `s3`, `Bun.file`, `Bun.$`).

### How web talks to services (end-to-end type safety)

1. Each service's root Elysia instance owns a path prefix: `new Elysia({ prefix: "/api/events" })`.
2. In dev, the Vite server proxies that same prefix to the service port (`server.proxy` in `vite.config.ts`).
3. The service package's `main` exports its app type (`export type Event = typeof event`).
4. `apps/web` lists the service as a `workspace:*` **devDependency** and builds an Eden Treaty client in `src/lib/api.ts`: `treaty<App>(window.location.origin)`.
5. Calls mirror the full path, e.g. `eventClient.api.events.health.get()`. They return `{ data, error }`, so throw `error` inside the `queryFn` so that TanStack Query sees the failure.

Adding a service means touching all of these. Create `apps/<name>/package.json` with the dev script `PORT=<port> bun --env-file=../../.env --watch src/index.ts` and a dependency on `@app/db`. Add a prefixed root instance with its type exported, a proxy entry in `vite.config.ts`, the web devDependency, and a treaty client in `api.ts`. Also add its health check to `src/routes/index.tsx`, the page that shows the status of every service.

**Better Auth mounting:** don't use `.mount(auth.handler)` inside the prefixed instance. `.mount()` strips the prefix, so Better Auth, which routes on the full `/api/auth/*` path, returns 404. `apps/auth/src/index.ts` forwards the request untouched with `.all('/*', { parse: 'none' }, ({ request }) => auth.handler(request))`. Better Auth's `baseURL` (`BETTER_AUTH_URL`) is the browser-facing origin, i.e. the Vite server in dev, not port 3001.

### Backend: Elysia 2

The services are on `elysia@^2.0.0-rc`, whose APIs differ from v1. Load the `elysiajs` skill or the docs instead of relying on memory. Follow https://next.elysiajs.com/essential/best-practice/. Target layout per service (`apps/event/src/index.ts` is still a single-file stub; split it as it grows):

```
src/
  index.ts             import app, export it, call .listen()
  app.ts               compose features with .use(); export app + App type; never listens
  env.ts               validated env
  routes/<feature>/
    index.ts           controller: Elysia instance; owns status codes, headers, cookies, redirects
    model.ts           request/response schemas + derived types
    service.ts         plain functions with explicit args; may query db directly
  plugins/             shared, *named* plugins (new Elysia({ name })), e.g. auth/role macros
  libs/                shared non-Elysia clients/helpers (only once a second feature needs them)
test/<feature>.test.ts
```

- **Models:** export one object per route named `[Pathname][Method]` relative to the prefix (`Post`, `ByIdGet`). It holds PascalCase `Body` / `Params` / `Query` / `Response` schemas, plus a matching `UnwrapModels<typeof X>` type. Import it as a namespace: `import * as EventModel from "./model"`. Models are the API contract, not DB tables, so never expose sensitive columns when deriving them from Drizzle.
- **Services:** never pass the request context or cookies. Pass only the values the service needs.
- **Errors:** return errors rather than throwing them, so Eden and OpenAPI can infer them. When the same error is used in several places, make it a class extending `HTTPError.id("CODE", status)`.
- **Dependencies:** use `decorate` for app-lifetime singletons and `derive` for per-request values. Release decorated resources in `onStop`.
- **Authorization:** enforce role and ownership checks in a named plugin or macro in `plugins/`, never ad hoc in handlers. Organizers may only touch their own events.
- **Testing:** test services directly, and test controllers through `app.handle()` or `treaty(app)`.

### Database: `@app/db`

- Put one schema file per domain in `packages/db/src/schema/` and re-export it from `schema/index.ts`. `drizzle.config.ts` reads the whole directory.
- Every table spreads `id()` (uuid, `defaultRandom`) and `...timestamps` (`created_at` / `updated_at` with `$onUpdate`) from `_columns.ts`. Use snake_case SQL column names and camelCase TS keys.
- Services import `db`, the tables and the query operators (`eq`, `and`, `sql`, …) from `@app/db`. If you need a new operator, add it to the re-export list in `packages/db/src/index.ts` instead of adding `drizzle-orm` to a service.
- Store S3 object **keys**, not URLs (e.g. `events.coverImageKey`).
- `schema/auth.ts` holds the Better Auth tables (`users`, `sessions`, `accounts`, `verifications`). They are plural (`usePlural: true`) with uuid ids (`generateId: "uuid"`), so other tables can reference `users.id` as a `uuid`.
  - The shape must match what Better Auth expects; it validates the Drizzle schema at startup and logs mismatches.
  - After adding a Better Auth plugin, run `cd apps/auth && bunx auth@latest generate --config src/libs/auth.ts --output <scratch file> --yes`, merge the diff into `auth.ts` using the `_columns.ts` helpers, then run the migration flow.
- Stripe access goes through the client in `apps/payment/src/libs/stripe.ts`. Only test keys (`sk_test_`) are accepted outside production.
- Migration flow: edit the schema → `bun run db:generate` → review the SQL in `packages/db/drizzle/` → `bun run db:migrate`.

### Frontend: `apps/web`

- **shadcn on Base UI:** the style is `base-maia`, so primitives come from `@base-ui/react`, not Radix. Use Base UI APIs (e.g. the `render` prop instead of `asChild`). The `migrate-radix-to-base` skill covers translating Radix-style examples. For a link styled as a button, apply `buttonVariants()` to a router `Link`, as `navbar.tsx` does. Load the `shadcn` skill before UI work.
- **Components:** always look for a shadcn component first (shadcn MCP / registry). If none fits the feature or design, create one in `src/components/` that follows shadcn theming. That means function components with `data-slot`, `cva` variants, `cn()` for class merging (`cn` comes from the `cn` package, re-exported by `@/lib/utils`), and theme tokens only (`bg-primary`, `text-muted-foreground`, `border`, `ring`, …), with no raw palette colors. Tokens live in `src/index.css` (oklch values for `:root` and `.dark`, teal primary, Google Sans). Dark mode is class-based (`.dark`).
- **Icons (lucide-react) are required:** put one in every button, form field label, section/card heading, nav item and empty state. Inside `Button`, mark them with `data-icon="inline-start"` or `"inline-end"` so the padding adjusts. Leave out size classes, because `Button` sizes child SVGs itself.
- **Routing:** file-based routes live in `src/routes/` and export `Route = createFileRoute(...)`. `src/routeTree.gen.ts` is generated by the router Vite plugin, so never edit it by hand. Use `@/` for imports from `src`.
- **Server state:** fetch all server state with TanStack Query through the Eden clients. Don't use raw `fetch`.
- **Forms:** follow https://ui.shadcn.com/docs/forms/tanstack-form, using `@tanstack/react-form` + zod.
  - Pass the schema as `useForm({ validators: { onSubmit: schema } })`.
  - Each `form.Field` render function returns `<Field data-invalid>` → `<FieldLabel htmlFor>` → a control with `aria-invalid` → `<FieldError errors={field.state.meta.errors}>`.
  - Show the error only when `isTouched && !isValid`.
  - The `<form onSubmit>` calls `e.preventDefault()` and then `form.handleSubmit()`.
- **Tables:** follow https://ui.shadcn.com/docs/components/base/data-table, using `@tanstack/react-table` (v9).
  - `columns.tsx` holds the column defs and the row-action dropdown.
  - `data-table-features.ts` holds the shared features object.
  - `data-table.tsx` is the generic table.
  - The route fetches data via Query.
- **Hotkeys:** use `@tanstack/react-hotkeys`.
- `@tanstack/react-form`, `zod`, `@tanstack/react-table` and `@tanstack/react-hotkeys` are **not installed yet**. Install them with `cd apps/web && bun add <pkg>`.
