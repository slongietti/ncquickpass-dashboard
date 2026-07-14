# HOV Dashboard

A personal dashboard for [NC Quick Pass](https://www.ncquickpass.com/) that shows your
**I-77 Express Lanes (HOV) toll activity grouped into trips**, and lets you manage your
**HOV declarations** (view current status, set a custom end date/time, and cancel) — all
from a single page.

> Unofficial, personal-use project. Not affiliated with or endorsed by NC Quick Pass or
> the North Carolina Turnpike Authority.

## Architecture

```
┌──────────────────┐   same-origin /api    ┌──────────────────┐   Bearer JWT    ┌──────────────────┐
│  Angular 17 SPA  │ ────────────────────► │   NestJS BFF     │ ──────────────► │  NC Quick Pass   │
│  (frontend/)     │ ◄──────────────────── │   (backend/)     │ ◄────────────── │  secure.ncquick… │
└──────────────────┘   HttpOnly cookie      └──────────────────┘                 └──────────────────┘
```

The **NestJS backend-for-frontend (BFF)** exists for two reasons:

1. **CORS** — NC Quick Pass's API does not permit third-party browser origins, so the SPA
   cannot call it directly. The BFF proxies every call server-to-server.
2. **Token security** — on login the BFF obtains the NCQP bearer token and stores it in a
   **signed, `HttpOnly`, `Secure` cookie**. The token lives in your browser but JavaScript
   can never read it, and it is never exposed to the SPA. **Your username and password are
   used only for the single login request and are never stored.**

## Features (single "Dashboard" page)

- **HOV status per vehicle** — each transponder with its current declaration status
  (Active / Submitted / None), a `datetime-local` picker to set the HOV **end date/time**,
  and a **Cancel** button for any active declaration.
- **I-77 HOV trips** — your toll activity filtered to the I-77 Express Lanes
  (`exitLocation` containing `77 EL`), grouped into **trips**: any tolls within **5 minutes**
  of each other are one trip. Each trip shows the time span and **total amount**, and expands
  (accordion) to list every individual toll.

## Running locally

Prerequisites: Node 20+ and npm.

```bash
# 1. Backend (BFF) — http://localhost:3000
cd backend
cp .env.example .env        # adjust if needed
npm install
npm run start:dev

# 2. Frontend (SPA) — http://localhost:4200  (proxies /api → :3000)
cd frontend
npm install
npm start
```

Then open http://localhost:4200 and log in with your NC Quick Pass credentials.

## Running with Docker

The whole stack ships as two containers. The frontend's nginx serves the built SPA
**and** reverse-proxies `/api` to the BFF, so the browser talks to a single origin
(the HttpOnly cookie stays same-site and there's no CORS to configure).

```bash
docker compose up --build
# open http://localhost:8080
```

Only the `web` container is published (`:8080`); the BFF is reachable only on the
internal compose network. For anything beyond local use, set a strong cookie secret
(and enable Secure cookies behind HTTPS):

```bash
COOKIE_SECRET=$(openssl rand -hex 32) COOKIE_SECURE=true docker compose up --build
```

| Service | Image base    | Role                                              |
| ------- | ------------- | ------------------------------------------------- |
| `web`   | `nginx`       | Serves the Angular SPA + proxies `/api` → `bff`   |
| `bff`   | `node`        | NestJS backend-for-frontend (not published)       |

## Project layout

| Path        | What it is                                              |
| ----------- | ------------------------------------------------------- |
| `backend/`  | NestJS BFF: auth (cookie session) + NCQP proxy endpoints |
| `frontend/` | Angular 17 standalone SPA: login + dashboard            |

## Security notes

- Credentials are POSTed once to the BFF over HTTPS and forwarded to NCQP; they are **not**
  persisted anywhere.
- The NCQP JWT is held only in an `HttpOnly`, `Secure`, signed session cookie set by the BFF.
- Set a strong `COOKIE_SECRET` in `backend/.env` for signing.
- The API surface was mapped from observed browser traffic; endpoint behavior may change if
  NC Quick Pass updates their site.

## License

[MIT](./LICENSE)
