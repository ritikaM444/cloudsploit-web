# CloudSploit Web

A **zero-cost, security-first web application** that turns the
[CloudSploit](cloudsploit/) CLI security scanner into a multi-user web service.
Register, connect a cloud account (Google Cloud, AWS, Azure, Oracle, GitHub, or
Alibaba), run scans, and browse findings from a browser instead of a terminal.

This project wraps the existing scanner (`cloudsploit/`) without modifying it,
so the app supports **every cloud provider the engine supports**. Pick the
provider when you add an account and supply that provider's credential JSON.

## Why zero cost

| Concern | Choice | Cost |
|---|---|---|
| Database | SQLite via Node's built-in `node:sqlite` | Free, no server |
| Queue | SQLite-backed job table + in-process worker | Free, no Redis |
| Crypto | Node's built-in `crypto` (scrypt, AES-256-GCM) | Free |
| Frontend | React + Vite + Tailwind | Free |
| Hosting | Self-host / Docker; deploy to any free tier later | Free |

> **Note on Cloud Spanner:** Cloud Spanner has a ~$65/month minimum and cannot
> meet the "absolutely free" requirement, so the datastore is SQLite instead.
> The data layer is isolated in `server/src/db/`, so swapping in another store
> later is contained.

## Architecture

```
Browser (React SPA)
   │  HTTP (same origin; cookies)
   ▼
API server (Fastify)  ──►  SQLite  (users, accounts, scans, findings)
   │  enqueue scan
   ▼
Scan worker  ──spawn──►  cloudsploit/index.js --json=…
                          (collection + scanning, out-of-process)
```

- **API server** (`server/`) handles auth, account management, and scan jobs.
- **Scan worker** polls for queued scans, decrypts credentials in memory, runs
  the CLI, and stores parsed findings.
- **Scanner** (`cloudsploit/`) stays untouched and is invoked as a child process.

## Tech stack

- **Backend:** Node.js 22+, TypeScript, Fastify, Zod, `node:sqlite`
- **Frontend:** React 19, React Router 7, TanStack Query 5, Tailwind CSS 4, Vite
- **Security:** scrypt password hashing, AES-256-GCM credential encryption,
  JWT in `httpOnly`/`SameSite=Strict` cookies, Helmet headers, rate limiting

## Repository layout

```
cloudsploit/   existing scanner (untouched)
server/        API + scan worker
client/        React SPA
docs/          guides (GCP setup, user manual, testing)
```

## Prerequisites

- Node.js **22.5+** (for `node:sqlite`)
- A cloud account and its read-only credentials. Google Cloud setup:
  [docs/gcp-setup.md](docs/gcp-setup.md). Other providers need a small JSON —
  the Accounts page shows the exact fields for the selected provider.

## Setup

```bash
# from the repo root
npm run install:all

# create the server secrets
cp server/.env.example server/.env
npm --prefix server run genkey      # paste the output into server/.env
```

## Run (development)

Two terminals:

```bash
npm run dev:server     # API on http://127.0.0.1:3000
npm run dev:client     # UI on  http://localhost:5173  (proxies /api to the server)
```

Open http://localhost:5173, register (the first user becomes admin), add a cloud
account, and start a scan. The Dashboard also shows the **user manual** inline.

## Run (production, single origin)

```bash
npm run build          # builds client/ into client/dist
npm start              # server serves both the API and the built SPA on :3000
```

Open http://127.0.0.1:3000.

## Docker

Docker is **optional** — the app also runs directly with Node. Use Docker only
if you prefer container isolation. The image installs all three packages and
runs the server, which serves the built SPA and the scan worker together.

```bash
export JWT_SECRET=...   # run `npm --prefix server run genkey` to obtain values
export MASTER_KEY=...
docker compose up --build
```

Then open http://localhost:3000.

## Deployment

The whole app is **one long-running Node process** (HTTP + background scan
worker) with a filesystem-backed SQLite database, so choose a host that supports
that:

| Host | Suitable? | Notes |
|---|---|---|
| **Render / Fly.io / Railway** | Yes (recommended) | Run `npm run build` then `npm --prefix server start`; attach a **persistent disk** mounted where `server/.env` `DB_PATH` points so SQLite survives deploys. Set `JWT_SECRET`, `MASTER_KEY`, `COOKIE_SECURE=true`, `NODE_ENV=production`. |
| A VPS (DigitalOcean/Hetzner) | Yes | Simplest if you already have one. |
| **Vercel / Netlify Functions** | **No** | Serverless: no persistent filesystem (SQLite is lost), no long-running worker, and no child-process scanning. |
| Cloud Run (with a volume) | Partly | Needs a mounted volume; ephemeral instances otherwise lose the DB. |

> **Docker is not required to deploy.** Render/Railway/Fly can run the plain
> Node start command with a persistent disk. If Docker isn't installed locally,
> just skip it and use `npm run dev` / `npm start`.

## API overview

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Create a user (first user = admin) |
| POST | `/api/auth/login` | Log in (sets auth cookie) |
| POST | `/api/auth/logout` | Clear session |
| POST | `/api/auth/password` | Change the current user's password |
| GET | `/api/auth/me` | Current user |
| GET/POST | `/api/accounts` | List / add cloud accounts (`provider` + `credentials`) |
| DELETE | `/api/accounts/:id` | Remove an account and delete its stored credentials |
| GET/POST | `/api/scans` | List / start scans |
| GET | `/api/scans/:id` | Scan status |
| GET | `/api/scans/:id/findings` | Findings + summary (filters: `status`, `severity`, `category`) |
| GET | `/api/health` | Liveness probe |

## Security model

- Cloud credentials are **encrypted at rest** with AES-256-GCM; the master key
  lives only in `server/.env` (use a secret manager in production).
- Passwords are hashed with **scrypt** (memory-hard, salted per user).
- Auth uses a **JWT in an `httpOnly`, `SameSite=Strict` cookie** — not readable
  by JavaScript, reducing XSS token theft. The dev server proxies `/api` so the
  cookie stays same-origin.
- Helmet security headers, request body size limits, and per-IP rate limiting.
- Credentials are decrypted only inside the scan worker, for the scan run, and
  transiently written to a locked-down temp file that is deleted afterwards.
- The scanner's service account should be **read-only** (see GCP guide).

## Roadmap

- Scheduled scans (cron) and email/Slack alerts on FAIL results
- PDF export of findings
- Workload Identity Federation instead of static cloud keys
- Refactor `engine.js` to return results in-process (removes the child process)

## License

The wrapped scanner (`cloudsploit/`) is GPL-3.0-or-later. Review its license
before redistribution.
