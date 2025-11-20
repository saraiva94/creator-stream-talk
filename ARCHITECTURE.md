# Creator Stream Talk – Architecture & Operations Guide

## 1. Platform Overview
Creator Stream Talk is a full-stack live-streaming platform where creators host paid live sessions, monetize via Mercado Pago, and deliver access through Jitsi Meet rooms. The codebase contains:
- **Frontend**: React 18 + TypeScript + Vite + Tailwind (see `src/`).
- **Backend**: Node.js + Express + TypeScript (see `backend/`).
- **Database**: Supabase Postgres with RLS policies and cron-driven Edge Functions (see `supabase/`).
- **Streaming**: Jitsi Meet public rooms; the backend generates random room slugs and distributes URLs once access is granted.
- **Payments**: Mercado Pago checkout preferences + webhook approvals.
- **Email**: Resend transactional emails for receipts, access, and live reminders.

## 2. Directory Layout
```
root/
├─ src/                    # React SPA (components, hooks, integrations)
├─ backend/                # Express API + middleware, services, routers
├─ supabase/               # SQL migrations, cron config, Edge Functions
├─ scripts/                # Utility scripts (e.g., print webhook URLs)
├─ ARCHITECTURE.md         # This document
└─ README_TECHNICAL.md     # Developer-focused quick-start
```

### Backend Structure (`backend/src`)
- `controllers/` – HTTP handlers that validate input (Zod), enforce auth, and return standardized JSON responses.
- `routes/` – Express routers mounting controllers plus middleware (auth, rate limit, raw-body, domain guards).
- `services/` – Business logic and integrations (`supabaseService`, `mercadoPagoService`, `jitsiService`, `emailService`, `statusService`).
- `middleware/` – Auth, CORS, request logging, rate limiting, raw-body parsers, webhook domain guard, error handler.
- `lib/` – Env loader, logger, response helpers, Supabase client factory.
- `shared/` – Reusable utilities (e.g., `liveMonitorCore`, Mercado Pago signature helper).
- `validation/` – Zod schemas grouped per domain (creators, lives, payments, email, withdrawals).

## 3. Environment & Tooling
1. `npm install` installs both frontend and backend dependencies.
2. Copy `.env.example` → `.env` and fill **every** key listed. The backend loads from the repo root `.env`.
3. Local dev: `npm run dev` (frontend) and `npm run backend:dev` (Express via `ts-node-dev`).
4. Production smoke: `npm run backend:build && node backend/dist/index.js` plus `npm run build` for the SPA.
5. Diagnostics: `npm run print:webhook-urls` prints the resolved public base + canonical webhook URLs.

### Required Environment Variables
**Backend (serverless Express under `/api`)**

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`
- `MERCADOPAGO_ACCESS_TOKEN` (alias `MERCADO_PAGO_ACCESS_TOKEN`), `MERCADOPAGO_WEBHOOK_SECRET`, `MERCADOPAGO_WEBHOOK_URL`, `MERCADOPAGO_CURRENCY`
- `RESEND_API_KEY`, `EMAIL_LOCALE`
- `PUBLIC_BASE_URL` (canonical domain used to derive webhook URLs)
- `ALLOWED_ORIGINS` (comma-delimited CORS whitelist)
- `ALLOWED_WEBHOOK_DOMAIN` (expected Host for inbound webhooks)
- `HEARTBEAT_INTERVAL_MS` (ms cadence used by the Supabase cron monitor)
- `HEARTBEAT_TOLERANCE_MS` (ms tolerance for host absence; camera inactivity uses 2× this value)
- `BACKEND_PORT`, `LOG_LEVEL` (local defaults 4000 / `info`)

**Frontend (SPA)**

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BASE_URL` (optional; defaults to `<origin>/api` in browsers)

The env loader (`backend/src/lib/env.ts`) now enforces the full production contract, resolves `PUBLIC_BASE_URL` (env → Vercel → local), derives canonical webhook URLs, and surfaces mismatch warnings (e.g., webhook URL vs. canonical). Diagnostics expose env coverage, domain guard state, and CORS alignment.

## 4. Authentication & Authorization
- **Auth**: `requireAuth` expects `Authorization: Bearer <Supabase access token>`, validates it with the Supabase Admin client, loads the profile + optional creator row, and injects `req.auth = { userId, email, profileId, creatorId, isAdmin }`.
- **Creator guard**: `requireCreatorAccount` ensures `req.auth.creatorId` exists before creator-only actions (balance, referrals, lives, withdrawals).
- **Admin guard**: `requireAdmin` requires `isAdmin` from the JWT’s role claims for `/admin/*` routes.
- All controllers consume `req.auth` instead of trusting IDs from the request body, ensuring consistent ownership enforcement.

## 5. Streaming Architecture (Jitsi)
- `lives.room_name` stores the randomly generated Jitsi slug (format: `creator_<id>_<timestamp>_<randomHex>`).
- **Starting a live (`POST /lives/start`)**:
  1. Creator authenticates (requires `creatorId`).
  2. Controller calls `jitsiService.createPrivateRoom(creatorId)` → generates slug + stores it via `supabaseService.saveLiveRoomName`.
  3. Response includes `{ roomName, jitsiUrl: https://meet.jit.si/<roomName>, status }` and transitions the live state to `waiting_for_host`.
- **Viewer access (`POST /lives/access`)**:
  1. Authenticated viewer must have `live_access` (set after Mercado Pago webhook approval).
  2. Controller fetches the live, verifies entitlement, and returns `{ accessUrl: https://meet.jit.si/<roomName> }`.
- **Live info (`GET /lives/:liveId/info`)**: returns metadata (title, price, status, `roomName`, `jitsiUrl`, lifecycle state) for the creator or entitled viewer.
- **Heartbeats & inactivity**: Supabase Edge Function `monitor-lives` (see `supabase/functions/monitor-lives`) runs every minute via Supabase cron (configured in `supabase/config.toml`). It queries active lives, checks `live_heartbeat` rows, and transitions lives to `ending/ended` when camera or host activity expires. No third-party webhooks are needed.

## 6. Payments, Revenue, and Access Control
1. **Checkout** (`POST /payments/create`)
   - Authenticated viewer supplies `liveId`.
   - Controller fetches the live (price + percentage splits), inserts a `payments` row (`pending`), and requests a Mercado Pago preference with metadata (`paymentId`, `liveId`, `userId`).
   - Response includes the Mercado Pago `init_point` URL.
2. **Webhook** (`POST /payments/webhook`)
   - Raw body parser preserves buffers for signature validation.
   - Middleware stack: raw-body → domain guard (Host check) → controller.
   - Controller enforces `User-Agent`, timestamp (±5 min), `x-idempotency-key`, and HMAC signature (via `verifyMercadoPagoSignature`). Duplicates are blocked using the `webhook_events` table (stores key + body hash).
   - Approved payments trigger:
     - `payments` row update (`approved`).
     - `live_access` insert (unique per `user_id` + `live_id`).
     - Revenue split via percentages on the live: creator earnings (`creator_balance`), optional parent affiliate earnings, and `platform_revenue` entry.
     - `commissions` entries for creator and parent.
     - Transactional emails (receipt + access link) using Resend.
3. **Viewer entitlements**
   - `live_access` table gate-keeps `/lives/access`.
   - `grantLiveAccess` and `addCreatorEarnings` helpers run inside a Supabase transaction to ensure atomicity.

## 7. Supabase Schema Highlights
Key tables (with RLS) include:
- `profiles`, `creators`, `lives` (with `room_name`, `status`, `creator_percent`, `affiliate_percent`, `platform_percent`, `is_active`, `ended_at`).
- `payments`, `live_access`, legacy room metadata tables (**removed**), `commission`, `creator_balance`, `referral_links`, `referral_conversions`, `platform_revenue`, `withdrawals`, `withdrawal_audit_log`.
- `live_heartbeat` and `live_end_log` track heartbeat events and auto-termination reasons.
- `webhook_events` captures Mercado Pago idempotency keys + SHA-256 body hash.
- Every table enabling user-facing data has explicit RLS policies: creators only see/update their data, viewers only access their own entitlements/payments, and service-role inserts (webhooks, cron jobs) are allowed via the backend’s service key.

The latest migrations (see `supabase/migrations/`) rename the legacy `daily_room_name` column to `room_name` and drop the removed room metadata table, so new environments match the Jitsi model from the first migration.

## 8. Email & Notifications
`emailService` sends three transactional templates through Resend:
1. **Payment receipt** – Confirms the purchase, amount, and live title.
2. **Access granted** – Includes the Jitsi access URL (`https://meet.jit.si/<room_name>`).
3. **Live starting** – Notifies followers/participants when a live transitions to `waiting_for_host`/`live`.
The service logs the last 100 sends in memory for quick troubleshooting (production systems should replace this with durable logging).

## 9. Observability & DX
- **Logging**: Pino logger (`backend/src/lib/logger.ts`) powers structured JSON logs. Controllers emit domain-specific events (`payments.webhook.approved`, `jitsi.live.started`, `creator.withdrawal.requested`, etc.).
- **Request logging**: `requestLogger` middleware logs method/path/status/duration for all requests when enabled.
- **Rate limiting**: `express-rate-limit` protects `/payments/create`, `/email/send`, `/lives/access`, `/creators/withdraw`.
- **Responses**: All controllers return `{ success: boolean, data?: T, error?: string }` with consistent HTTP status codes.
- **CORS**: `backend/src/middleware/cors.ts` restricts origins to the `ALLOWED_ORIGINS` whitelist, logs blocked hosts, and is surfaced through diagnostics.
- **Diagnostics & health**:
  - `GET /status` – simple heartbeat (`API OK`).
  - `GET /status/health` – uptime, version, last heartbeat run (from Supabase), active lives count, canonical version.
  - `GET /status/version` – package version + commit hash + build timestamp.
  - `GET /status/diagnostics` – Supabase, Mercado Pago, Resend probes; env coverage; canonical webhook URLs; domain-guard state; rate-limit + logger mode; Jitsi info block.
  - `GET /status/checklist` – Deployment checklist: env presence, table existence, webhook URL matches, cron/monitor status, rate-limit + auth enforcement flags.

## 10. Deployment & Vercel Architecture
- `backend/index.ts` runs in dual mode:
  - **Local dev** – Starts the HTTP server on `BACKEND_PORT`, installs graceful shutdown hooks, logs `server.mode=local_dev`.
  - **Vercel serverless** – Detects `VERCEL === '1'`, skips `app.listen`, exports the Express handler, and logs `server.mode=vercel_serverless`. Long-running jobs (heartbeat monitor) live in Supabase Edge Functions.
- `vercel.json` now splits traffic: `/api/(.*)` rewrites to `/backend/index.ts` (serverless Express), while everything else rewrites to `/index.html` so the Vite SPA in `dist/` handles routing (`/`, `/dashboard`, `/live/:id`, payment callbacks). RAW_BODY remains enabled for the backend function bundle.
- **Cron monitor** – Supabase cron (configured in `supabase/config.toml`) invokes `monitor-lives` every minute, so serverless deployments remain stateless.
- **Canonical webhook URLs** – Env loader exposes `publicBaseUrl`, `canonicalMercadoPagoWebhookUrl`, and mismatch warnings; `/status/checklist` reports whether `MERCADOPAGO_WEBHOOK_URL` matches the canonical value. Run `npm run print:webhook-urls` before copying URLs into third-party dashboards.
- **Frontend base URL** – Set `VITE_API_BASE_URL=https://<domain>/api` so the SPA targets the routed API in production; local dev can rely on the same prefix against the local Express server.
- **Known pitfalls**:
  - Forgetting to set `PUBLIC_BASE_URL` or `ALLOWED_ORIGINS` leads to failed CORS or webhook diagnostics.
  - Mercado Pago signatures fail if Vercel’s RAW_BODY pipeline changes; keep the raw-body middleware intact when adding new body parsers.
  - The monitor requires Supabase cron; disabling it leaves stale lives active.

## 11. API Reference (backend highlights)
- `GET /status`, `/status/health`, `/status/version`, `/status/diagnostics`, `/status/checklist`
- `GET /lives` (public alias `/lives/public`), `GET /lives/creator`, `POST /lives/start`, `GET /lives/:liveId/info`, `POST /lives/access`
- `POST /payments/create`, `POST /payments/webhook`
- `POST /email/send`
- `POST /creators/register`, `GET /creators/balance`, `GET /creators/commissions`, `GET /creators/referrals`, `POST /creators/referral-code`, `POST /creators/withdraw`, `GET /creators/withdraw/history`
- `GET /admin/withdrawals/pending`, `POST /admin/withdrawals/approve`, `POST /admin/withdrawals/reject`, `POST /admin/withdrawals/mark-paid`

Every endpoint adheres to the standardized response envelope and requires auth unless explicitly documented as public (e.g., `/status/*`, `/lives/public`).

## 12. Future Enhancements
- Jitsi JWT-secured rooms to restrict access beyond obscured URLs.
- Durable email logging (Supabase table or observability pipeline).
- Public REST surface for scheduled lives & search filters.
- Automated Mercado Pago refund/chargeback handlers.

This document reflects the current Jitsi-based architecture. Keep it in sync whenever schema, environment contracts, or deployment workflows change.
