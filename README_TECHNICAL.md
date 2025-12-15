# Creator Stream Talk — Technical README

Este documento consolida stack, setup e fluxos críticos (créditos, monetização, afiliados, lives) para desenvolvimento.

## 1) Stack & Arquitetura
- **Frontend:** React 18 + TypeScript + Vite + Tailwind + shadcn/ui (`src/`), roteado em `src/App.tsx`, cliente Supabase em `src/integrations/supabase/client.ts`.
- **Backend:** Node/Express + TypeScript (`backend/`), Supabase Auth via middleware `requireAuth`, rotas em `backend/src/routes/`, serviços em `backend/src/services/`.
- **Supabase:** Postgres com RLS, migrações SQL em `supabase/migrations/`, Edge Function `monitor-lives` (cron em `supabase/config.toml`), funções auxiliares (create-payment, mercadopago-webhook, livekit-room).
- **Mercado Pago:** Checkout preference + webhook (`/payments/webhook`) para creditar acessos, créditos e afiliados.
- **LiveKit:** Video streaming via WebRTC, Edge Function `livekit-room` gera tokens JWT, components em `src/components/webrtc/`.
- **Créditos:** Armazenados como inteiros em `credits_wallet`; ledger em `credit_purchases`; consumo por sessão em `live_consumption`; earnings em `creator_earnings`; wallets em `creator_wallet`.

## 2) Setup Local (passo a passo)
1. **Clonar**
   ```bash
   git clone <repo-url>
   cd creator-stream-talk
   ```
2. **Instalar deps**
   ```bash
   npm install
   cd backend && npm install && cd ..
   ```
3. **Variáveis `.env` (raiz)**
   - Copie `.env.example` para `.env`.
   - Preencha:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_PUBLISHABLE_KEY`
     - `VITE_SUPABASE_PROJECT_ID`
     - `VITE_USE_LIVEKIT=true`
     - `SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `BACKEND_PORT`
     - `MERCADOPAGO_ACCESS_TOKEN`
     - `MERCADOPAGO_PUBLIC_KEY`
   - Frontend usa apenas as variáveis `VITE_*`; o backend lê `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` via `backend/src/lib/env.ts`.
   - Opcional: `PUBLIC_SITE_URL`, `MERCADOPAGO_WEBHOOK_URL`, `ALLOWED_ORIGINS`, `LOG_LEVEL`.
4. **Linkar Supabase**
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   ```
5. **Aplicar migrações**
   ```bash
   npx supabase db push
   ```
6. **Gerar tipos**
   ```bash
   npx supabase gen types typescript --linked > supabaseTypes.ts
   npx supabase gen types typescript --linked > src/integrations/supabase/types.ts
   ```
7. **Rodar backend**
   ```bash
   cd backend
   npm run dev   # ts-node-dev
   ```
8. **Rodar frontend**
   ```bash
   npm run dev   # Vite
   ```
9. **monitor-lives (cron)**
   - Config em `supabase/config.toml` (cron a cada 1 min chamando `functions/monitor-lives`).
   - Em dev, pode chamar manualmente via Supabase Functions ou HTTP (POST/GET) para validar ciclo.

## 3) Fluxo de Créditos
- **Compra:** frontend chama `/payments/create-preference` com `purchaseType: 'credits'`; usuário paga no Mercado Pago.
- **Webhook:** `/payments/webhook` valida e chama `registerCreditPurchase` → insere em `credit_purchases` (idempotente por `payment_id`) e incrementa `credits_wallet.balance_credits`.
- **Sessão de live:** ao entrar, cria/usa `live_consumption` (live_id, user_id, session_token).
- **Heartbeats (monitor-lives):** soma `seconds_watched`, calcula ticks de 10s (1 crédito = 10s), debita wallet. Se acabar crédito, encerra sessão, seta `ended_at` e remove `live_access`.
- **Settlement:** ao encerrar live, `creatorEarningsService` soma `credits_consumed`, converte (500 cents ↔ 180 créditos; 80/20 split), insere/atualiza `creator_earnings` e credita `creator_wallet.balance_cents`.

## 4) Fluxo de Saques do Criador
- **Acúmulo:** `creator_wallet.balance_cents` recebe `net_cents` ao fim de cada live (settlement).
- **Solicitação:** `POST /withdrawals/request` (auth creator) move `amount_cents` de balance → pending, cria `payout_requests` (status `pending`).
- **Admin:** `/admin/payouts` rotas aprovam (pendente ↓) ou rejeitam (pendente ↓, balance ↑). Histórico via `payout_requests` e wallets via `creator_wallet`.

## 5) Fluxo de Afiliados
- **Referral:** `referrals` guarda `referrer_id` → `referred_id`.
- **Payout:** webhook de registro com `purchaseType: 'registration'` chama `registerAffiliatePayoutForSignup`:
  - nível 1: +100 cents; nível 2: +50 cents.
  - grava `transactions` (type `affiliate`, unique `external_id` por pagamento/nível) e credita `profiles.balance` via `increment_balance`.
- **Painel:** usuário vê resumo/link/histórico em `Profile` (AffiliateDashboardPanel).

## 6) Função `monitor-lives`
- Roda a cada minuto; para lives ativas:
  - Avalia heartbeats (encerra se host ausente/câmera inativa).
  - Atualiza `live_consumption` e debita créditos por ticks de 10s; corta acesso ao zerar saldo.
  - Ao encerrar live, chama settlement → `creator_earnings` + crédito em `creator_wallet`.

## 7) Video Streaming (LiveKit WebRTC)
- **Edge Function:** `supabase/functions/livekit-room/index.ts` gera tokens JWT
- **Componentes:** `WebRTCPublisher` (criador) e `WebRTCViewer` (viewer) em `src/components/webrtc/`
- **Secrets necessários (Supabase):** `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- **Frontend:** `VITE_USE_LIVEKIT=true` ativa modo LiveKit

## 8) Rotas Principais da Trilha B
- `GET /credits/balance` (auth) → saldo de créditos.
- `POST /withdrawals/request`, `GET /withdrawals/wallet-summary` (creator auth).
- `GET /creator/earnings` (creator auth).
- `/affiliate/overview`, `/affiliate/history`, `/affiliate/link` (auth).
- `/admin/payouts/*` (admin), `/admin/creators/*` (admin).

## 9) Checklist de Testes Manuais
1. Compra créditos via Mercado Pago; webhook recebido; `credits_wallet` aumenta.
2. Entrar em live ativa; créditos consumidos com o tempo.
3. Ao zerar créditos, acesso cortado (live_access removido, sessão finalizada).
4. Encerrar live gera/atualiza `creator_earnings` e credita `creator_wallet`.
5. Criador vê saldo e histórico de earnings em `/creator/payouts`.
6. Criador solicita saque; `balance_cents` diminui, `pending_cents` aumenta.
7. Admin aprova saque; `pending_cents` reduz, status muda para aprovado/pago.
8. Admin rejeita saque; valor volta para `balance_cents`.
9. Afiliado gera link; novo usuário registra pelo link; comissão aparece no painel de afiliado.
10. Criador não aprovado tenta iniciar live → 403.
11. Criador aprovado inicia live normalmente (câmera/mic via WebRTC).
12. Affiliate overview mostra total ganho, saldo disponível e total de indicados.
13. Pagamento de registro com `purchaseType: 'registration'` gera transações `affiliate` nível 1/2 e credita saldo.
14. "Atualizar" nos painéis (wallet/affiliate/earnings) refaz chamadas e exibe novos valores.
15. monitor-lives manual (chamada HTTP) não quebra e mantém estados consistentes.
