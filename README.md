# HOV Dashboard

**An NC Quick Pass extension project — scheduling and other features drivers want but the
North Carolina state site doesn't provide.**

The official [NC Quick Pass](https://www.ncquickpass.com/) site lets you file an HOV
declaration for the I-77 Express Lanes one at a time, by hand, and lists your tolls
undifferentiated. This dashboard closes those gaps from a single page: a recurring **weekly
HOV schedule** that files your declarations automatically (even while you're logged out),
full declaration management, and your I-77 activity grouped into trips.

> Unofficial, personal-use project. Not affiliated with or endorsed by NC Quick Pass or
> the North Carolina Turnpike Authority.

## Features

- **Weekly HOV scheduling** (opt-in) — a per-vehicle Monday–Sunday schedule (multiple time
  ranges per day, or "All Day") that automatically creates future-dated NCQP declarations. A
  daily background job keeps a rolling ~7-day horizon filled even while you're logged out, so
  your HOV status is set without you touching the site. Ad-hoc declarations still work, and an
  overlap with a scheduled window prompts you to cancel the scheduled one in favor of the ad-hoc.
- **HOV status per vehicle** — each transponder with its current declaration status
  (Active / Submitted / None), a `datetime-local` picker to set the HOV **end date/time**,
  and a **Cancel** button for any active declaration.
- **I-77 HOV trips** — your toll activity filtered to the I-77 Express Lanes
  (`exitLocation` containing `77 EL`), grouped into **trips**: any tolls within **5 minutes**
  of each other are one trip. Each trip shows the time span and **total amount**, and expands
  (accordion) to list every individual toll.

## Architecture

```mermaid
flowchart LR
    SPA["Angular 17 SPA<br/>(ui/)"]
    BFF["NestJS BFF<br/>(api/)"]
    NCQP["NC Quick Pass<br/>secure.ncquickpass.com"]

    SPA -->|"same-origin /api"| BFF
    BFF -->|"Bearer JWT"| NCQP
    NCQP -.->|"JSON"| BFF
    BFF -.->|"JSON + HttpOnly cookie<br/>(token never in JS)"| SPA
```

The **NestJS backend-for-frontend (BFF)** exists for two reasons:

1. **CORS** — NC Quick Pass's API does not permit third-party browser origins, so the SPA
   cannot call it directly. The BFF proxies every call server-to-server.
2. **Token security** — the BFF holds the NCQP bearer token in a signed, `HttpOnly`, `Secure`
   cookie, so JavaScript never reads it and it is never exposed to the SPA (see [Security](#security)).

## Running locally

Prerequisites: Node 22+, npm, and a Postgres database. The easiest Postgres is the
compose `db` service (published on `localhost:5432`); `api/.env.example` already
points `DATABASE_URL` at it.

```bash
# 0. Start a local Postgres (or point DATABASE_URL at your own)
docker compose up -d db

# 1. API (BFF) — http://localhost:3000
cd api
cp .env.example .env        # DATABASE_URL already targets the compose db
npm install
npm run start:dev           # applies migrations, then serves

# 2. UI (SPA) — http://localhost:4200  (proxies /api → :3000)
cd ui
npm install
npm start
```

Then open http://localhost:4200 and log in with your NC Quick Pass credentials.

## Running with Docker

The whole stack ships as three containers: Postgres (`db`), the NestJS BFF (`bff`),
and nginx (`web`). The `web` container serves the built SPA **and** reverse-proxies
`/api` to the BFF, so the browser talks to a single origin (the HttpOnly cookie
stays same-site and there's no CORS to configure).

```bash
docker compose up --build
# open http://localhost:8080
```

Only the `web` container is published (`:8080`); the BFF and DB are reachable only on
the internal compose network. For anything beyond local use, set a strong cookie secret
(and enable Secure cookies behind HTTPS):

```bash
COOKIE_SECRET=$(openssl rand -hex 32) COOKIE_SECURE=true docker compose up --build
```

> **Upgrading from an older SQLite build?** The `ncquickpass-data` volume now holds
> Postgres data — Postgres won't initialize over the old SQLite file. Reset it first:
> `docker compose down -v && docker compose up --build`.

| Service | Image base    | Role                                              |
| ------- | ------------- | ------------------------------------------------- |
| `db`    | `postgres`    | Persistent Postgres database (not published)      |
| `bff`   | `node`        | NestJS backend-for-frontend (not published)       |
| `web`   | `nginx`       | Serves the Angular SPA + proxies `/api` → `bff`   |

## Configuration

All backend config is environment variables (see [`api/.env.example`](./api/.env.example)).
**Only `DATABASE_URL` and `COOKIE_SECRET` are required** — everything else has a safe
code default or gates an optional feature.

| Variable | Required | Purpose | Where it's set |
| --- | --- | --- | --- |
| `DATABASE_URL` | **Yes** | Postgres connection string | Local: `api/.env`. Prod: **GitHub repo secret**, synced onto the Lambda every release by CI (`set-lambda-env-var.yml`) and used for migrations. |
| `COOKIE_SECRET` | **Yes** | Signs the session cookie | Local: `api/.env`. Prod: **Lambda env var** (set once at bootstrap; not in GitHub). |
| `NCQP_BASE_URL` / `NCQP_CLIENT_ID` | No | NC Quick Pass upstream | Code defaults to the real values; override via `api/.env` or the Lambda env. |
| `PORT` | No | API port (default 3000) | `api/.env` locally; the Lambda Web Adapter handles it in prod. |
| `CORS_ORIGIN` | No | Cross-origin allow-list (off when empty) | Empty everywhere — the SPA is same-origin. |
| `COOKIE_SECURE` | No | Marks the cookie `Secure` | `false` locally; `true` on the Lambda (HTTPS). |
| `CREDENTIAL_KEY` | Feature | KMS key for the credential vault | Prod: **Lambda env** = KMS key ARN. Enables unattended weekly scheduling. |
| `CREDENTIAL_KEY_LOCAL` | Feature | Dev AES key for the vault | Local only (`api/.env`); prod uses `CREDENTIAL_KEY`. |
| `CRON_SECRET` | Feature | Guards `POST /api/internal/cron` | Prod: **Lambda env**, and the same value in the EventBridge schedule input. Unused locally (cron runs in-process). |

Locally, every value comes from `api/.env` (copy from `.env.example`). In production the
values live on the **Lambda function's environment** — `DATABASE_URL` is the one exception,
kept as a GitHub secret so CI keeps the function in sync when it's rotated. CI's AWS auth uses
the `OIDC_AWS_ROLE_ARN` **org** secret, which is not an application variable.

## Deployment

Production runs on AWS as a **single Lambda container** (the NestJS API also serves
the Angular SPA, same-origin) behind **CloudFront**, with **Neon** (serverless
Postgres) as the database and **EventBridge Scheduler** driving the daily reconcile.
Live at **https://ncquickpass.go-volare.com**.

CI/CD (`.github/workflows/`):

- **Push to `main`** → `build.yml` runs tests, builds the combined image to ECR, and
  drafts a GitHub Release. Nothing deploys.
- **Publish that Release** → `release.yml` applies pending Prisma migrations, syncs the
  `DATABASE_URL` secret onto the Lambda, deploys the released image, and promotes `:latest`.

Full one-time AWS bootstrap (ECR, Lambda, OIDC role, CloudFront, KMS, EventBridge,
Neon) is in [`docs/deployment.md`](./docs/deployment.md).

## Project layout

| Path        | What it is                                              |
| ----------- | ------------------------------------------------------- |
| `api/`  | NestJS BFF: auth (cookie session) + NCQP proxy endpoints |
| `ui/`   | Angular 17 standalone SPA: login + dashboard            |

## Security

- **Login token** — kept in a signed, `HttpOnly`, `Secure` cookie set by the BFF; JavaScript
  never sees it and it's never sent to the SPA. Set a strong `COOKIE_SECRET` for signing.
- **Credentials** — used only for the single login request and **not stored** — the one exception
  is opt-in weekly scheduling, where they're encrypted (AWS KMS in prod via `CREDENTIAL_KEY`; a
  local AES-256-GCM key in dev). The scheduler decrypts them transiently in memory to obtain a
  session token; they're never logged, never returned to the browser, and deleted when you remove
  your schedule. A background job must decrypt without you present, so this isn't zero-knowledge —
  which is why it's open source and auditable. The in-app **How it works** page (`/how-it-works`)
  walks through it with a diagram.
- **Reverse-engineered API** — endpoints were mapped from observed browser traffic and may change
  if NC Quick Pass updates their site.

## License

[MIT](./LICENSE)
