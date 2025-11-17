# Creator Stream Talk – Architecture & Workspace Notes

## Tech Stack Overview
- **Client runtime**: [Vite](vite.config.ts) bootstraps a React 18 + TypeScript SPA with SWC-based fast refresh.
- **Styling system**: Tailwind CSS (see `tailwind.config.ts` and `src/index.css`) plus shadcn/ui component primitives under `src/components`.
- **State & data**: React Query (`src/App.tsx`) provides async caching; React Router defines page routing in the same file; a custom `LanguageProvider` inside `src/hooks/useLanguage.tsx` handles localization context.
- **Integrations**:
  - Supabase client factory lives in `src/integrations/supabase/client.ts` and expects URL + anon key env vars.
  - Video streaming helper utilities for Daily.co calls are defined in `src/lib/daily.ts`.
  - Placeholder payment hooks are collected in `src/lib/payments.ts`.
- **Backend integrations**:
  - `/backend` now proxies Daily.co: `POST /daily/create-room` provisions locked rooms, while `POST /daily/create-host-token` and `POST /daily/create-viewer-token` mint role-specific meeting tokens via the Daily REST API. These calls require `DAILY_API_KEY` and `DAILY_PROJECT_URL` in `.env`.
  - `/backend` also fronts Mercado Pago: `POST /payments/create-preference` creates checkout preferences with `liveId`/`userId` metadata, while `POST /payments/webhook` validates notifications, fetches the payment status from Mercado Pago, and records approved purchases in Supabase so the viewer token service can grant access later on. Configure this integration with `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.
- **Backend runtime**: `/backend` hosts a Node.js + Express API written in TypeScript. `ts-node-dev` powers local development while `tsc` builds to `backend/dist`. The server loads shared environment variables from the repo-level `.env`.

## Directory Layout
```
src/
├─ components/        # shadcn/ui wrappers, shared widgets, and layout primitives
├─ hooks/             # React hooks (language, auth helpers, etc.)
├─ integrations/      # Supabase types + client factory
├─ lib/               # Cross-cutting utilities (Daily, payments, formatting, i18n)
├─ pages/             # Top-level routed screens (Home, Auth, Room, Dashboard, etc.)
├─ App.tsx            # App shell with providers and router wiring
└─ main.tsx           # Vite entry point that renders <App />
```

```
backend/
├─ src/
│  ├─ controllers/   # Express handlers orchestrating between routes & services
│  ├─ routes/        # HTTP route definitions (e.g., GET /status)
│  ├─ services/      # Business logic and integrations (node-fetch helpers, etc.)
│  └─ lib/           # Cross-cutting helpers (environment loader, logging, etc.)
├─ index.ts          # App entry point that mounts middleware + routes
└─ tsconfig.json     # Backend-specific TypeScript configuration
```

## Local Environment & Tooling
1. Install dependencies with `npm install` (already executed in this workspace).
2. Copy `.env.example` to `.env` and fill in Supabase credentials so the generated client can initialize.
3. Start the frontend with `npm run dev`.
4. Start the backend API with `npm run backend:dev` (runs `ts-node-dev` from `/backend`). Use `npm run backend:build` followed by `node backend/dist/index.js` for production-style smoke tests.
5. Optional quality gates: `npm run lint` and `npm run build` validate the React app, while `npm run backend:build` ensures the API compiles.

## Known Issues / Follow-Ups Before Feature Work
1. **Secrets previously committed** – the `.env` file containing Supabase secrets was tracked. It is now ignored, but regenerate keys if the repository has already been shared publicly.
2. **Environment setup** – Developers must provide real values for `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_SUPABASE_PROJECT_ID` before auth or database features can work.
3. **Security review pending** – Supabase policies/functions under `supabase/` were not audited yet; confirm row-level security before exposing write APIs.
4. **NPM vulnerabilities** – `npm install` reports 3 moderate issues; run `npm audit fix` (or review manually) prior to production hardening.
5. **Daily.co credentials** – `src/lib/daily.ts` hardcodes iframe defaults but lacks environment-driven room URLs/token generation. We will need a server-side token service before going live.

## Payment Flow
1. **Preference creation** – The client requests `POST /payments/create-preference` with `{ liveId, userId, price }`. The backend calls Mercado Pago with our access token, injects `{ liveId, userId }` metadata, and returns `{ init_point, preferenceId }` so the frontend can redirect the buyer.
2. **Webhook handling** – Mercado Pago calls `POST /payments/webhook`. The backend ensures the `x-signature` header is present, looks up the payment via `/v1/payments/:id`, and verifies `status === 'approved'` before processing.
3. **Access storage** – Approved transactions are upserted into the Supabase `live_access` table with `live_id`, `user_id`, `status`, and `granted_at` timestamp. Future viewer-token endpoints can check this table to gate paid access.
4. **Configuration** – The backend requires Mercado Pago (`MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY`) and server-side Supabase credentials (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) inside `.env` to complete the workflow.
