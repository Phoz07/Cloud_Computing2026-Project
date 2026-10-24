# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Eventide: an event ticketing website built as a Bun-workspace monorepo of microservices. Stack: React + TanStack Router (web), ElysiaJS (services), Drizzle + Postgres (data), S3 (files). User-facing copy is in Thai.

### Roles

- **user**: enroll in a ticket, view own tickets, manage own profile, apply to become an organizer
- **organizer**: create events, ticket types and enrollment forms; add team members; check in tickets; view the event dashboard; manage **only their own** events
- **admin**: manage all events, suspend accounts, manage other accounts, approve organizer applications (user → organizer)

### Auth and email

- **Auth:** `apps/auth` runs Better Auth (load the `better-auth-*` skills before changing it).
  - Login is email/password, plus Google, which is enabled only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set (`GET /api/auth/providers` tells the web).
    - Account linking keeps Better Auth's defaults: Google is merged into an existing account only if that account's email is verified. Email verification isn't set up, so password users get `account_not_linked` and link Google from `/profile` instead.
  - The admin plugin stores the role (`user` / `organizer` / `admin`, defined in `packages/auth-guard/src/permissions.ts` together with the domain permission statements) on `users.role`. Suspending an account is the admin plugin's **ban**.
  - Organizer applications live in `apps/auth` (`/api/auth/organizer-applications`, table `organizer_applications`). Approving one sets the role in a transaction.
  - `GET /api/auth/organizers/:id` is the public organizer profile the event page shows (organization name from the approved application, avatar, approval date). It never returns the email or the application's contact/reason, and answers 404 for plain users.
  - Deleting an account (self-delete or the admin plugin's remove-user) is refused with `ORGANIZER_HAS_EVENTS` while the user organizes events. `events.organizer_id` is `ON DELETE RESTRICT`, and Better Auth deletes a user's sessions and accounts before the user row, so the check has to run before Better Auth starts.
  - Bootstrap the first admin with `cd apps/auth && bun run admin:promote <email>` after registering in the web.
- **Service auth:** only `apps/auth` touches the auth tables and holds `BETTER_AUTH_SECRET`. Every other service does `.use(authGuard)` from `@app/auth-guard`.
  - On each request the guard forwards the cookie to `AUTH_SERVICE_URL/api/auth/get-session` and caches the answer in Redis for 60s.
  - `databaseHooks` in `apps/auth/src/libs/auth.ts` write a revoked marker on ban, role change and sign-out, so those apply on the next request. Anything else that changes a role or deletes sessions outside Better Auth must call `markUserRevoked()`.
  - Design, diagrams and failure modes: `docs/auth.md`.
- **Email:** nothing sends mail inline. Producers call `enqueueMail({ to, template, props })` from `@app/mail`, which puts a message on the SQS `mail-queue`. `apps/mail-worker` consumes the queue, renders the template and sends with **Nodemailer over Gmail SMTP**.
  - Producers send data, never HTML. Each template's props are typed in `packages/mail/src/templates.ts`: raw strings (React escapes them), dates as ISO strings and amounts in baht. The subject, the wording and all formatting live in the template.
  - Templates are **React Email** (`react-email`) in `apps/mail-worker/emails/<template>.tsx`. Each one default-exports the component with `PreviewProps` and exports `subject(props)`. They share `MailLayout` and the blocks in `emails/_components/` (`EventDetails`, `CtaButton`, `Note`, `RefundOutcome`, …).
  - The Tailwind theme (`_components/theme.ts`) copies the web's tokens under the same names, in hex because mail clients don't read oklch. Use px values, not rem.
  - `src/render.tsx` registers every template, renders HTML plus a plain-text part and attaches the logo inline (`cid:logo@eventide`, from `emails/static/logo.png`).
  - Adding a mail means adding its props to `MailTemplates`, adding `emails/<name>.tsx` and adding a registry entry; a missing entry is a type error.
  - Preview: `bun run --filter @app/mail-worker preview` (http://localhost:3010).
  - A message is deleted only after it sends. Failures are retried and land in `mail-dlq` after 5 receives. That includes a template that throws on its props, so a fixed template can redrive them. A message with an unknown template is logged and left to reach the DLQ the same way.
  - Without `GMAIL_USER` / `GMAIL_APP_PASSWORD`, the worker runs dry and logs each mail's recipient, subject and plain text instead of sending it.

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
bun run --filter @app/web start   # production server for the built web (dist/ + per-URL Open Graph tags)
bun run --filter @app/mail-worker preview   # React Email preview of every mail template on :3010
```

**Type checking:** run `bun check` from **inside** a workspace (`cd apps/web && bun check`; `cd apps/event && bun check src/index.ts`). The root `bun run typecheck` reads the root tsconfig, which has no DOM lib and no `@/*` alias, so it reports false errors in `apps/web`.

**Tests:** use `bun test` (`import { test, expect } from "bun:test"`). Suites that need env or infra get a `test` script that passes `--env-file=../../.env`; run them with `bun run test` inside `packages/auth-guard`, `packages/storage`, `apps/auth`, `apps/event`, `apps/registration` or `apps/payment` (they need `infra:up`). `apps/mail-worker` also has a `test` script, which renders every template and needs no infra. The `test` scripts of `apps/event`, `apps/registration` and `apps/payment` run each file in its own process, because the auth mock (`mock.module`) leaks between files. For a single file use `bun test test/event.test.ts`, and for a single test use `bun test -t "pattern"`.

**shadcn CLI:** `components.json` lives in `apps/web`, so run `cd apps/web && bunx shadcn@latest add <component>`. The shadcn MCP server is configured in `.mcp.json`.

## Local infrastructure (`docker-compose.yml`)

| Service | Port(s) | Notes |
|---|---|---|
| Postgres 18 | 5432 | `DATABASE_URL` |
| Redis 8 | 6379 | `REDIS_URL` (the default env var for Bun's `redis` client) |
| ElasticMQ (SQS) | 9324 API, 9325 UI | queues defined in `infra/elasticmq/elasticmq.conf` |
| MinIO (S3) | 9000 API, 9001 console | `minio-init` creates the `event-assets` bucket |

- **Queues:** `mail-queue` has a 30s visibility timeout and a 10s long poll. After 5 receives a message moves to `mail-dlq`. A new queue must be added to `elasticmq.conf` and get its URL variable in `.env.example`.
- **S3:** the `S3_*` variables in `.env.example` are the ones Bun's built-in `s3` client reads by default, so `import { s3 } from "bun"` works without config. `minio-init` also sets a bucket policy that lets anyone read `public/*`; every other prefix stays private. In dev the Vite server proxies `/files/<key>` to the bucket.
- **Env loading:** workspace scripts run from the package directory, so each one passes `--env-file=../../.env`. Keep doing that in new packages.

## Architecture

### Workspaces

- `apps/web` (`@app/web`): Vite + React 19 SPA on :5173. Uses TanStack Router (file-based), TanStack Query and shadcn/ui. `server/` holds its production server and the per-URL `<head>` (see **Link previews** below).
- One Elysia service per domain, each with its own process, port and path prefix:

  | Workspace | Port | Prefix | Owns |
  |---|---|---|---|
  | `apps/auth` | 3001 | `/api/auth` | Better Auth: accounts, sessions, roles, bans |
  | `apps/event` | 3002 | `/api/events` | events (CRUD, slug, status, refund policy, HTML description, a Redis cache of the detail, Open Graph images), categories (admin-only), cover + gallery, invitations (who may open an `invite`-status event, by email), ticket types and their registration forms (`ticket_types`, `ticket_type_questions`) |
  | `apps/registration` | 3003 | `/api/regis` | seat availability (plus a live WebSocket feed), enrollments (enroll, approve / reject), tickets ("my tickets"), check-in |
  | `apps/payment` | 3004 | `/api/payment` | Stripe Checkout for enrollments, the Stripe webhook, refunds (`payments`, `refunds`) |

- `apps/mail-worker`: an SQS consumer with no HTTP server. It renders queued mail with the React Email templates in `emails/` and sends it through Gmail. It is the only workspace that depends on React besides the web.
- `packages/db` (`@app/db`): the Drizzle schema and client that every service shares.
- `packages/auth-guard` (`@app/auth-guard`): roles and permissions (`./permissions`, browser-safe, also used by the web), the session introspection + Redis cache, and the `authGuard` Elysia plugin.
- `packages/mail` (`@app/mail`): the mail queue contract. It holds the `MailMessage` / `MailContent` types (a template name plus its props, from `src/templates.ts`), the shared `sqs` client, `enqueueMail()` for producers and `parseMailMessage()` for the worker.
- `packages/storage` (`@app/storage`): file storage that each service imports (a library, not a service), built on [files-sdk](https://files-sdk.dev) over Bun's S3 client. See **Files** below.
- `packages/tickets` (`@app/tickets`): ticket issuing shared by registration and payment (a library): which enrollments hold seats, confirming one, mailing its tickets, announcing seat changes. See **Tickets** below.
- `services/*` is declared as a workspace glob but is unused. Root `bun run dev` only starts `apps/*`.

The generic Bun advice doesn't fully apply here. The web app **does** use Vite (not Bun HTML imports), and the DB layer uses Drizzle on the **postgres.js** driver (not `Bun.sql`). Elsewhere in services, prefer Bun built-ins (`Bun.redis`, `s3`, `Bun.file`, `Bun.$`).

### How web talks to services (end-to-end type safety)

1. Each service's root Elysia instance owns a path prefix: `new Elysia({ prefix: "/api/events" })`.
2. In dev, the Vite server proxies that same prefix to the service port (`server.proxy` in `vite.config.ts`).
3. The service package's `main` exports its app type (`export type Event = typeof event`).
4. `apps/web` lists the service as a `workspace:*` **devDependency** and builds an Eden Treaty client in `src/lib/api.ts`: `treaty<App>(window.location.origin)`.
5. Calls mirror the full path, e.g. `eventClient.api.events.health.get()`. They return `{ data, error }`, so throw `error` inside the `queryFn` so that TanStack Query sees the failure.

Adding a service means touching all of these. Create `apps/<name>/package.json` with the dev script `PORT=<port> bun --env-file=../../.env --watch src/index.ts` and a dependency on `@app/db`. Add a prefixed root instance with its type exported, a proxy entry in `vite.config.ts`, the web devDependency, and a treaty client in `api.ts`. Also add its health check to `src/routes/status.tsx` (`/status`), the page that shows the status of every service.

**Better Auth mounting:** don't use `.mount(auth.handler)` inside the prefixed instance. `.mount()` strips the prefix, so Better Auth, which routes on the full `/api/auth/*` path, returns 404. `apps/auth/src/index.ts` forwards the request untouched with `.all('/*', { parse: 'none' }, ({ request }) => auth.handler(request))`. Better Auth's `baseURL` (`BETTER_AUTH_URL`) is the browser-facing origin, i.e. the Vite server in dev, not port 3001.

### Backend: Elysia 2

The services are on `elysia@^2.0.0-rc`, whose APIs differ from v1. Load the `elysiajs` skill or the docs instead of relying on memory. Follow https://next.elysiajs.com/essential/best-practice/. Target layout per service (`apps/event`, `apps/registration` and `apps/payment` follow it, e.g. `apps/event/src/routes/{events,categories,media,invitations,ticket-types}`):

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
- **Authorization:** `.use(authGuard)` gives the route options `{ auth: true }`, `{ role: ["organizer", "admin"] }` and `{ permission: { event: ["create"] } }`, each adding `user` / `session` to the context. Put ownership checks (organizers may only touch their own events) in a named plugin or macro in `plugins/`, never ad hoc in handlers. `apps/event/src/plugins/event-owner.ts` (`{ eventOwner: true }`, which adds `event`) is the example. A macro can't read another macro's derives, so such a macro calls `authenticate()` from `@app/auth-guard` itself.
- **Testing:** test services directly, and test controllers through `app.handle()` or `treaty(app)`.

### Database: `@app/db`

- Put one schema file per domain in `packages/db/src/schema/` and re-export it from `schema/index.ts`. `drizzle.config.ts` reads the whole directory.
- Every table spreads `id()` (uuid, `defaultRandom`) and `...timestamps` (`created_at` / `updated_at` with `$onUpdate`) from `_columns.ts`. Use snake_case SQL column names and camelCase TS keys.
- Services import `db`, the tables and the query operators (`eq`, `and`, `sql`, …) from `@app/db`. If you need a new operator, add it to the re-export list in `packages/db/src/index.ts` instead of adding `drizzle-orm` to a service.
- Store S3 object **keys**, not URLs (e.g. `events.coverImageKey`). `users.image` is the one exception; see **Files** below.
- `schema/auth.ts` holds the Better Auth tables (`users`, `sessions`, `accounts`, `verifications`). They are plural (`usePlural: true`) with uuid ids (`generateId: "uuid"`), so other tables can reference `users.id` as a `uuid`.
  - The shape must match what Better Auth expects; it validates the Drizzle schema at startup and logs mismatches.
  - After adding a Better Auth plugin, run `cd apps/auth && bunx auth@latest generate --config src/libs/auth.ts --output <scratch file> --yes`, merge the diff into `auth.ts` using the `_columns.ts` helpers, then run the migration flow.
- Stripe access goes through the client in `apps/payment/src/libs/stripe.ts`. Live keys (`sk_live_` / `rk_live_`) are refused outside production.
- Migration flow: edit the schema → `bun run db:generate` → review the SQL in `packages/db/drizzle/` → `bun run db:migrate`.

### Files: `@app/storage`

- **Uploads go through the owning service** as multipart. The route body is `{ file: t.File() }`, and the service calls `storeFile(kind, ownerId, file)`.
  - It sniffs the bytes (files-sdk `contentType()`), then checks the kind's types and size (`validation()`).
  - It **returns** `UnsupportedFile` (415), `FileTooLarge` (413) or `StorageUnavailable` (503) with Thai `detail`s.
  - Don't put `type` on `t.File`: Elysia 2 would need a file-type detector, and its 422 isn't in Thai.
- **Kinds** live in `packages/storage/src/kinds.ts` (`avatar`, `eventCover`, `eventAsset`), so add new ones there.
  - Keys are `public/<users|events>/<ownerId>/<folder>/<uuidv7>`.
  - Keys have no extension, because the stored Content-Type comes from the bytes.
- **Store the key** in the DB (`events.coverImageKey`, `event_assets.key`) and send `fileUrl(key)` (`/files/<key>`) in responses, so the web never imports `@app/storage`.
  - The exception is `users.image`, which holds the `/files/<key>` path, because Better Auth owns that field and Google writes URLs into it.
  - `ownedKey(url, kind, ownerId)` gives the key back only when the URL is that owner's own file, so a Google photo or a path the user set by hand is never deleted.
- **Replace, then delete:** commit the new key (lock the row when replacing), then `deleteFile(old)`. It is best effort and never throws, so a failure leaves an orphaned object rather than a failed request.
- **Tests:** `useMemoryStorage()` from `@app/storage/testing` swaps in files-sdk's in-memory adapter and returns it for assertions.
- **Not used on purpose:** files-sdk's `files-sdk/api` gateway and its React upload components. They would move authorization and the DB write out of the service's request and lose the Eden types.
- Design, diagrams and failure modes: `docs/storage.md`.

### Tickets: `@app/tickets`

- **Ticket types** (`apps/event`) have a kind: `first_come` (needs a `quota`), `approval` (the organizer approves each enrollment, no quota) or `invite` (only emails in `event_invitations`, one enrollment per invitation). Prices are whole baht; 0 is free, a paid price is at least ฿20 (Stripe's minimum). `maxPerUser` counts across all of an account's enrollments of that type.
  - Each type has its own questions (`ticket_type_questions`: short text, long text, choice), saved as one list that replaces the old one. First name, last name and email are on every ticket and are not questions.
  - The web pre-fills ticket 1 from `users.firstName` / `lastName` (Better Auth `additionalFields`, editable on `/profile`, filled from Google).
- **An enrollment** (`apps/registration`) is one order: `quantity` tickets with one attendee each (`tickets`: name, lowercase email, `answers` copied with their labels).
  - Statuses: `pending` (approval) → `awaiting_payment` (paid) → `confirmed`, or `rejected` / `expired`.
  - **Active** = `confirmed`, `pending`, or `awaiting_payment` whose `expires_at` is ahead (`activeEnrollment()`). A lapsed hold stops counting at once, with no job; reads show it as `expired` (`effectiveStatus()`).
  - **Seats:** anything that counts seats against the quota first locks the `ticket_types` row (`SELECT … FOR UPDATE`): enrolling, seat holds, quota edits and `confirmEnrollment()`.
  - "My tickets" shows confirmed tickets the account bought **or** that carry its email.
- **Seat holds** (`apps/registration`, table `seat_holds`): opening the enroll page of a `first_come` type holds 1 seat for 10 minutes (`POST /ticket-types/:id/hold`), and the form's ticket count resizes it (`PATCH`, same deadline). The web counts down and offers to hold again once it lapses.
  - One hold per account and ticket type. Asking again while it runs returns it unchanged, so a reload or another device carries on with it.
  - `seatsTaken()` counts active holds (`activeHold()`) with active enrollments, and holds count toward `maxPerUser`. `enroll()` leaves the buyer's own hold out of the count and deletes it; the enrollment then holds the seats (35 minutes when paid). A lapsed hold stops counting at once, like a payment hold.
- **Live seats:** the event page, the enroll page and the organizer's ticket pages keep their seat counts current over a WebSocket (`/api/regis/events/:eventId/availability/live`, `useLiveSeats()` in the web).
  - Anything that changes seat counts or the list of ticket types must call `announceSeats(eventId)` from `@app/tickets` **after its transaction commits**. It publishes to the Redis channel `seats:changed`, never throws and doesn't wait.
  - `apps/registration/src/routes/availability/feed.ts` recounts only the events its own sockets watch (at most every 250 ms each, plus a timer for the next lapsing hold, plus a 30s resync in case Redis lost a message) and fans out with Bun's `server.publish`.
  - The socket carries only the counts everyone shares (`held` among them). `mine`, `hold` and `state` still come from the GET, and the web re-derives `sold_out` with `withLiveSeats()`, which must match `getAvailability()`.
- **Payment** (`apps/payment`): `POST /checkout` makes (or reuses) a Stripe Checkout session; `POST /webhook` (`parse: 'none'`, `constructEventAsync`, since the SDK verifies with SubtleCrypto under Bun) confirms the enrollment, or refunds a payment that arrived after its hold lapsed and the seats went.
  - When the webhook never arrives, `POST /checkout/verify` (the order page's "ตรวจสอบการชำระเงิน") asks Stripe about the order's pending sessions and settles them the way the webhook would (`src/libs/settle.ts`). `POST /checkout` does the same first, so it never sends the buyer back to a session that has already been paid.
  - Paid first_come / invite enrollments hold seats for 35 minutes (the 30-minute session plus slack); approved paid ones have 72 hours to pay.
  - Dev: set `STRIPE_WEBHOOK_SECRET` to the `whsec_…` that `bun run stripe:listen` prints (the Stripe CLI needs the events named; the script lists the six events the webhook handles).
  - Stripe setup, from creating a sandbox and a restricted key to the production webhook endpoint: `docs/stripe.md`.
- **Refunds** (`apps/payment`, table `refunds`) are whole-order and cancel the enrollment (`cancelled`, `markCancelled()`), which frees its seats and invitation.
  - The buyer (`POST /refunds`) gets the policy's percent until `starts_at − cutoff`. The policy is the one snapshotted onto `enrollments.refund_percent` / `refund_cutoff_hours` at enroll time, and `refundTerms()` in `@app/tickets` is the one place that reads it.
  - The organizer or an admin (`POST /enrollments/:id/refund`) refunds 100% at any time.
  - `issueRefund()` (`src/libs/refund.ts`) refunds through Stripe only a card payment (`charges.list` tells). Anything else (PromptPay) would need Stripe to email the buyer for a bank account, so it is refunded **by hand**: recorded as `requires_action` with a null `stripe_refund_id`, and the buyer's mail (`libs/mail.ts` sends `manual: true`) asks them to send their order number (the enrollment id) and bank account to the contact channels (`refundContacts` in `apps/mail-worker/emails/_components/refund-claim.tsx`, mock values). Marking such a refund done isn't built yet.
  - For a card, it first looks for a refund Stripe already made for the payment but we never recorded (`refunds.list`, matched on `metadata.paymentId`) and records that one, so a payment is refunded at most once. There is no fixed idempotency key, because Stripe replays a refused request under the same key for 24 hours, even after its cause is fixed. A card refund can fail later, so `refund.updated` / `refund.failed` keep `refunds.status` current.
- Enrollments keep their event, ticket type and invitation with `ON DELETE RESTRICT`, so those services answer `EVENT_HAS_ENROLLMENTS`, `TICKET_TYPE_IN_USE` and `INVITATION_USED` instead.
- Design, lifecycle diagrams and failure modes: `docs/tickets.md`.

### Event cache: `apps/event`

- `GET /api/events/:id` (by uuid or slug) and every route that loads an event through `findVisibleEvent()` read the event detail from Redis first (`src/libs/event-cache.ts`).
  - Keys: `event:id:<uuid>` holds the detail JSON (the API's `EventDetail`), and `event:slug:<slug>` holds the id. TTL is 5 minutes.
  - Visibility is still decided per request from the cached detail (status, `publishAt`, organizer) plus the invitation lookup, so one entry serves every viewer.
  - Lists (`GET /`, `/mine`), the `eventOwner` macro and other services read Postgres directly.
- **Every write to an event must update the cache after it commits:** `refreshEvent(id, previousSlug?)` re-reads the event and replaces the entry, so the next read already sees it.
  - It is called by create, update (including status, slug and suspension) and cover changes. A delete calls `forgetDeletedEvent()`, which leaves a `gone` marker on the id for one TTL. A category rename calls `forgetCategoryEvents()`, since entries embed the category.
  - Readers fill the cache only with `NX`, and refreshes don't overwrite `gone`, so a read or update that raced a write can't put an old copy back.
- Redis failures fall through to Postgres: slower, never wrong.

### Link previews (Open Graph)

Crawlers (LINE, Facebook, X, Discord) read only the HTML and never run the SPA, so the server puts each URL's tags into it.

- **Images** (`apps/event/src/routes/og`): `GET /api/events/og/site`, `/og/events/:id` (uuid or slug) and `/og/categories/:slug` return 1200×630 JPEGs. Takumi (`takumi-js`) renders the node trees in `cards.ts` with Google Sans (latin + thai woff2 from `@fontsource-variable/google-sans`).
  - They read events as an anonymous viewer (`findVisibleEvent(id, null)`), so a draft, scheduled, invite-only or suspended event answers 404 like a missing one.
  - Covers come from `readFile()` in `@app/storage`. Takumi skips bytes it can't decode, and a failed render is retried without images.
  - Dates are formatted in `Asia/Bangkok` (`format.ts`), because the server's time zone is arbitrary.
- **Tags** (`apps/web/server/head.ts`): `resolveHead()` builds the title, description, canonical link and `og:*` / `twitter:card` tags; `injectHead()` puts them between the `<!--head-->` and `<!--/head-->` markers in `index.html`.
  - It reads the event service without a cookie (`EVENT_SERVICE_URL`), waits at most 1.5 s, and otherwise falls back to the site's card. Every value goes through `escapeHtml`, since titles are user input.
  - Absolute URLs use `BETTER_AUTH_URL` as the public origin, like the links in mail.
  - An event's image URL carries `?v=<updatedAt>`, so an edit gives crawlers a new URL. The images themselves are cached for a day (categories for an hour).
  - Dev: the Vite plugin `server/head-plugin.ts` fills the block per request (and with the defaults at build time). Production: `bun run --filter @app/web start` (`server/index.ts`, port 3000) serves `dist/` and fills it per request. The reverse proxy sends `/api/*`, `/files/*` and the WebSocket to the services and the bucket, and everything else to it.
  - The SPA keeps the tab title current with `usePageTitle()` (`src/hooks/use-page-title.ts`), which resets to "Eventide" when the page unmounts. Titles go through `pageTitle()` in `src/lib/site.ts`, which the server shares.

### Frontend: `apps/web`

- **shadcn on Base UI:** the style is `base-maia`, so primitives come from `@base-ui/react`, not Radix. Use Base UI APIs (e.g. the `render` prop instead of `asChild`). The `migrate-radix-to-base` skill covers translating Radix-style examples. For a link styled as a button, apply `buttonVariants()` to a router `Link`, as `navbar.tsx` does. Load the `shadcn` skill before UI work.
- **Components:** always look for a shadcn component first (shadcn MCP / registry). If none fits the feature or design, create one in `src/components/` that follows shadcn theming. That means function components with `data-slot`, `cva` variants, `cn()` for class merging (`cn` comes from the `cn` package, re-exported by `@/lib/utils`), and theme tokens only (`bg-primary`, `text-muted-foreground`, `border`, `ring`, …), with no raw palette colors. Tokens live in `src/index.css` (oklch values for `:root` and `.dark`, teal primary, Google Sans). Dark mode is class-based (`.dark`).
- **Icons (lucide-react) are required:** put one in every button, form field label, section/card heading, nav item and empty state. Inside `Button`, mark them with `data-icon="inline-start"` or `"inline-end"` so the padding adjusts. Leave out size classes, because `Button` sizes child SVGs itself.
- **Routing:** file-based routes live in `src/routes/` and export `Route = createFileRoute(...)`. `src/routeTree.gen.ts` is generated by the router Vite plugin, so never edit it by hand. Use `@/` for imports from `src`.
- **Server state:** fetch all server state with TanStack Query through the Eden clients. Don't use raw `fetch`.
- **Auth in the web:** the Better Auth client is `auth` in `src/lib/auth-client.ts`; `authClient` in `api.ts` stays the Eden treaty for the auth service.
  - Read the session with `useSession()` / `sessionQueryOptions` from `src/lib/session.ts`. Pages that need a user go under `src/routes/_authed/`, whose `beforeLoad` redirects to `/login?redirect=`. Role checks use `hasRole()` in `beforeLoad`.
  - Map Better Auth errors to Thai with `authErrorMessage()`, and our services' problem documents with `problemMessage()`.
- **Toasts:** this is a Base UI project, so use `toast.add()` from `@/components/ui/toast`, not sonner.
- **Forms:** follow https://ui.shadcn.com/docs/forms/tanstack-form, using `@tanstack/react-form` + zod.
  - Pass the schema as `useForm({ validators: { onSubmit: schema } })`.
  - Each `form.Field` render function returns `<Field data-invalid>` → `<FieldLabel htmlFor>` → a control with `aria-invalid` → `<FieldError errors={field.state.meta.errors}>`.
  - Show the error only when `isTouched && !isValid`.
  - The `<form onSubmit>` calls `e.preventDefault()` and then `form.handleSubmit()`.
  - For text inputs and textareas, `TextField` and `SubmitButton` in `src/components/form-field.tsx` already render this structure (with the label icon and pending spinner).
- **Tables:** follow https://ui.shadcn.com/docs/components/base/data-table, using `@tanstack/react-table` (v9).
  - `columns.tsx` holds the column defs and the row-action dropdown (route-local ones live in a `-components/` folder, which the router ignores).
  - `data-table-features.ts` holds the shared features object.
  - `data-table.tsx` is the generic table.
  - The route fetches data via Query.
- **Hotkeys:** use `@tanstack/react-hotkeys` (`useHotkey("Mod+S", …)`; the event editor's save bar is the example).
- **Drag to reorder:** `@dnd-kit/react` (`DragDropProvider` + `useSortable`, with `isSortable(source)` in `onDragEnd` feeding TanStack Form's `field.moveValue`). The ticket-type question builder is the example; it collapses the other items while dragging because they differ a lot in height.
