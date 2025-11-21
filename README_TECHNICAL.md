# Creator Stream Talk – Technical Reference

This document summarizes how to work on the codebase after the migration to the Jitsi streaming architecture.

## 1. Stack Summary
- **Frontend**: React 18 + TypeScript + Vite + Tailwind + shadcn/ui (see `src/`).
- **Backend**: Express + TypeScript (see `backend/`) with Supabase Auth validation, Mercado Pago integration, and Jitsi room orchestration.
- **Database**: Supabase Postgres with migrations in `supabase/migrations/`, cron config in `supabase/config.toml`, and Edge Functions in `supabase/functions/`.
- **Streaming**: Jitsi Meet public rooms built from backend-generated `room_name` slugs.
- **Payments**: Mercado Pago checkout preferences + webhook approvals.
- **Emails**: Resend transactional templates.

## 2. Project Structure
```
creator-stream-talk/
├─ src/
│  ├─ components/          # shadcn/ui wrappers + UI primitives
│  ├─ hooks/               # useLanguage, toast helpers, etc.
│  ├─ integrations/
│  │   └─ supabase/        # frontend Supabase client & types
│  ├─ lib/                 # client utilities (payments, formatting)
│  ├─ pages/               # routed screens (Home, Dashboard, Room, etc.)
│  ├─ App.tsx              # Router + providers
│  └─ main.tsx             # SPA bootstrap
├─ backend/
│  ├─ src/controllers/     # HTTP handlers (lives, payments, creators, admin)
│  ├─ src/routes/          # Express routers (status, lives, payments, email)
│  ├─ src/services/        # supabaseService, mercadoPagoService, jitsiService, emailService
│  ├─ src/middleware/      # auth, cors, rate-limit, raw-body, domain guard, error handler
│  ├─ src/lib/             # env loader, logger, responses, Supabase client
│  ├─ src/shared/          # liveMonitorCore, Mercado Pago signature helper
│  └─ index.ts             # Express entrypoint (dual-mode local + Vercel)
├─ supabase/
│  ├─ migrations/          # SQL migrations (room_name, revenue, withdrawals, etc.)
│  ├─ functions/
│  │   ├─ create-payment/  # Mercado Pago helper
│  │   └─ monitor-lives/   # Cron-invoked heartbeat enforcement
│  └─ config.toml          # Cron schedule (monitor every 1 minute)
├─ scripts/
│  └─ printWebhookUrls.ts  # Prints resolved base + webhook URLs
└─ vercel.json             # SPA + API rewrites for Vercel (backend at /api/*)
```

### Vercel deployment shape
- **Backend**: Express serverless function bundled from `backend/index.ts`, reachable at `/api/*` via `vercel.json` rewrites. RAW_BODY is enabled for Mercado Pago webhooks. Build with `npm run backend:build` (invoked by `npm run vercel-build`).
- **Frontend**: Vite SPA built to `dist/`; all non-API routes rewrite to `/index.html` for client-side routing (`/`, `/dashboard`, `/live/:liveId`, payment callbacks, etc.).
- **Base URL config**: Set `VITE_API_BASE_URL=https://<domain>/api` (or rely on `window.location.origin` during local dev with the same prefix) so the client targets the routed API.

## 3. Backend API (Key Endpoints)
| Endpoint | Auth | Description |
| --- | --- | --- |
| `GET /status`, `/status/health`, `/status/version` | public | Health surfaces + build info. |
| `GET /status/diagnostics`, `/status/checklist` | admin token | Deep readiness data (Supabase, Mercado Pago, Resend, CORS, canonical URLs, monitor state). |
| `GET /lives` (alias `/lives/public`) | public | Lists active/scheduled lives with pricing/status info. |
| `GET /lives/creator` | creator | Creator’s own lives + lifecycle state. |
| `POST /lives/start` | creator | Generates/stores `room_name`, transitions to `waiting_for_host`, returns `{ roomName, jitsiUrl }`. |
| `GET /lives/:liveId/info` | auth | Returns metadata + `jitsiUrl` for creators or entitled viewers. |
| `POST /lives/access` | auth | After payment approval, returns `{ accessUrl: https://meet.jit.si/<room_name> }`. |
| `POST /payments/create` | auth | Creates Mercado Pago checkout preference + pending payment row. |
| `POST /payments/webhook` | Mercado Pago | Validates HMAC, processes approvals, grants access, credits balances, sends emails. |
| `POST /registration/checkout` | optional/auth | Creates the R$5 registration preference with two-level affiliate metadata or honors admin free links. |
| `POST /email/send` | auth | Triggers Resend transactional emails. |
| `POST /creators/register` | auth | Promotes profile to creator, handles referral code. |
| `GET /creators/balance`, `/commissions`, `/referrals` | creator | Finance dashboards + referral analytics. |
| `POST /creators/referral-code` | creator | Creates or returns a referral link. |
| `POST /creators/withdraw`, `GET /creators/withdraw/history` | creator | Withdrawal request + history. |
| `/admin/withdrawals/*` | admin | Finance workflows to approve/reject/pay withdrawals. |

All non-public routes enforce Supabase Auth via `requireAuth`, return `{ success, data }` envelopes, and include structured logging.

Registration checkout follows a fixed split: no referral → platform keeps the full R$5; referral → direct referrer earns R$1.00 (100 cents) and the root/parent earns R$0.50 (50 cents). If the direct referrer is a root creator, they receive both shares. Admin free links mark the registrant as a root creator without charging or emitting commissions.

## 4. Streaming Flow (Jitsi)
1. **Creator starts a live**
   - `POST /lives/start` → `jitsiService.createPrivateRoom` generates `room_name` and persists it on the `lives` row.
   - Response contains the slug plus `https://meet.jit.si/<room_name>` so the frontend can embed the room.
2. **Viewer purchases access**
   - `POST /payments/create` returns Mercado Pago `init_point`.
   - After checkout, Mercado Pago sends a webhook that the backend validates and processes.
3. **Access grant**
   - Approved webhook inserts `live_access` and credits balances/commissions.
   - Emails include the same Jitsi URL for the viewer.
4. **Viewer joins**
   - `POST /lives/access` checks entitlement and responds with `{ accessUrl }` pointing to the Jitsi meeting.
5. **Inactivity monitor**
   - Supabase Edge Function `monitor-lives` runs every minute, reads `live_heartbeat`, and ends stale lives (transition to `ending`/`ended` and logs `live_end_log`).

## 5. Supabase Schema Highlights
- `lives` – includes `room_name`, `price`, revenue percentages, lifecycle state, `is_active`, `ended_at`.
- `payments` – payment ledger with Mercado Pago metadata and webhook idempotency keys.
- `live_access` – viewer entitlements (unique `(user_id, live_id)` constraint).
- `creator_balance`, `commissions`, `referral_links`, `referral_conversions`, `platform_revenue` – monetization + affiliate accounting.
- Registration referrals: `profiles` now carry `is_root_creator`, `referrer_id`, `referrer_parent_id`, and `affiliate_earnings` (cents) with audit rows in `affiliate_logs` plus pending context in `registration_referrals` (driven by the registration webhook RPC).
- `withdrawals`, `withdrawal_audit_log` – payout workflow with admin RLS policies.
- `live_heartbeat`, `live_end_log` – inactivity tracking for the cron-based monitor.
- `webhook_events` – stores `idempotency_key` + SHA-256 body hash for Mercado Pago webhooks.
All tables enforce RLS policies matching the backend’s expectations (creators can only see their data, service role can perform privileged inserts/updates).

## 6. Environment & Diagnostics
See `.env.example` for the authoritative list. Highlights:
- **Backend (required)**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `MERCADOPAGO_ACCESS_TOKEN` (alias `MERCADO_PAGO_ACCESS_TOKEN`), `MERCADOPAGO_WEBHOOK_SECRET`, `MERCADOPAGO_WEBHOOK_URL`, `MERCADOPAGO_CURRENCY`, `RESEND_API_KEY`, `EMAIL_LOCALE`, `PUBLIC_BASE_URL`, `ALLOWED_ORIGINS`, `ALLOWED_WEBHOOK_DOMAIN`, `HEARTBEAT_INTERVAL_MS`, `HEARTBEAT_TOLERANCE_MS`, `BACKEND_PORT`, `LOG_LEVEL`.
- **Frontend (required)**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; optional `VITE_API_BASE_URL` (defaults to `<origin>/api`).
- `MERCADOPAGO_WEBHOOK_URL` must equal `${PUBLIC_BASE_URL}/api/payments/webhook`; diagnostics report mismatches and operators can confirm via `npm run print:webhook-urls`.
- `/status/diagnostics` exposes `env`, `urlConsistency`, `jitsi` block (mode + sample URL), CORS whitelist, logger level, rate-limit state, and monitor snapshot pulled from Supabase.
- `/status/checklist` is the deploy runbook: env coverage, table existence, webhook readiness, rate-limit + auth/admin enforcement, cron configuration.

## 6.1 Deployment checklist (Vercel)
1. Provision all backend env vars in Vercel Project Settings (Production/Preview) as listed in `.env.example` (including `PUBLIC_BASE_URL`, `ALLOWED_WEBHOOK_DOMAIN`, heartbeat interval/tolerance).
2. Set `VITE_API_BASE_URL=https://<your-domain>/api` so the SPA calls the routed Express function.
3. Ensure `MERCADOPAGO_WEBHOOK_URL` matches `${PUBLIC_BASE_URL}/api/payments/webhook` (diagnostics warn on mismatch).
4. Deploy with `vercel.json` present; Vercel will run `npm run vercel-build` (backend + frontend) and publish `dist/` as the SPA output.
5. Confirm `/status/diagnostics` and `/status/checklist` return `ok` in the deployed environment.
6. Verify SPA routes (`/`, `/dashboard`, `/live/:id`, payment callbacks) resolve to `index.html` while `/api/*` endpoints respond via Express.

## 7. Development Tips
- **Auth**: Use Supabase Auth tokens (from the frontend or CLI) to call creator routes; never pass IDs manually.
- **Raw-body webhooks**: Keep `backend/src/middleware/rawBodyParsers.ts` attached to `/payments/webhook` so HMAC validation succeeds locally and on Vercel. `vercel.json` sets `RAW_BODY=true` for the function bundle.
- **CORS**: Update `ALLOWED_ORIGINS` when testing from different dev domains; unknown origins are blocked and logged.
- **Logging**: Set `LOG_LEVEL=debug` for verbose request logs in dev; production defaults to `info` but still emits structured business events.
- **Cron monitor**: Supabase cron (configured in `supabase/config.toml`) invokes `monitor-lives` every minute; adjust `schedule` there if environments require a different cadence.

## 8. Testing & Build Commands
- `npm run dev` – Frontend dev server.
- `npm run backend:dev` – Backend watcher via `ts-node-dev`.
- `npm run backend:build` – Type-check + compile Express API.
- `npm run build` – Frontend production build.
- `npm run print:webhook-urls` – Prints canonical base + webhook URLs using the current env.
- `npm run vercel-build` – Runs backend + frontend builds for the Vercel pipeline.

## 9. Future Enhancements
- Secure Jitsi rooms using JWTs or custom moderators once needed.
- Add viewer chat, moderation, and subscription management to the frontend.
- Surface platform revenue + accounting exports via dedicated admin endpoints.
- Introduce automated Mercado Pago refund/chargeback handling.

This README reflects the Jitsi-based backend and should remain in sync with `ARCHITECTURE.md` and the Supabase migrations. Update it whenever new routes, schema changes, or deployment requirements land.
