# RELATÓRIO COMPLETO DO SISTEMA DE SAQUES

**Data:** 2026-01-08  
**Objetivo:** Documentar sistema atual para migração de Woovi para Velana.io

---

## ÍNDICE

1. [Tabelas de Saque (Database)](#1-tabelas-de-saque-database)
2. [Código Backend](#2-código-backend)
3. [Código Frontend](#3-código-frontend)
4. [Integração Woovi Atual](#4-integração-woovi-atual)
5. [Fluxo Completo de Saque](#5-fluxo-completo-de-saque)
6. [Variáveis de Ambiente](#6-variáveis-de-ambiente)
7. [Regras de Negócio](#7-regras-de-negócio)
8. [Pontos de Modificação para Velana](#8-pontos-de-modificação-para-velana)

---

## 1. TABELAS DE SAQUE (DATABASE)

### 1.1 `payout_requests` (PRINCIPAL)

**Descrição:** Armazena todas as solicitações de saque dos criadores.

```sql
CREATE TABLE public.payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,          -- ID do criador/usuário
  amount DECIMAL(10,2) NOT NULL,      -- Valor em centavos
  status TEXT NOT NULL DEFAULT 'pending',  -- Status do saque
  bank_account_id UUID REFERENCES creator_bank_accounts(id),
  approved_by UUID,                   -- Admin que aprovou
  approved_at TIMESTAMPTZ,            -- Data de aprovação
  paid_at TIMESTAMPTZ,                -- Data de pagamento
  created_at TIMESTAMPTZ DEFAULT now(),
  pix_key TEXT,                       -- Chave PIX
  pix_key_type TEXT,                  -- Tipo: CPF, CNPJ, EMAIL, PHONE, RANDOM
  psp_transaction_id TEXT,            -- ID da transação no PSP (Woovi)
  psp_response JSONB,                 -- Resposta completa do PSP
  failure_reason TEXT,                -- Motivo da falha (se houver)
  admin_notes TEXT,                   -- Notas do admin
  source_type TEXT DEFAULT 'creator', -- Origem: 'creator' ou 'affiliate'
  idempotency_key TEXT                -- Chave de idempotência (correlationId)
);
```

**Status possíveis:**
- `pending` - Aguardando aprovação/processamento
- `approved` - Aprovado pelo admin
- `paid` - Pagamento confirmado
- `rejected` - Rejeitado pelo admin
- `cancelled` - Cancelado
- `failed` - Falhou no processamento

**RLS Policies:**
```sql
-- Criadores veem próprios pedidos
CREATE POLICY "Creators can view own payout requests" ON payout_requests 
  FOR SELECT USING (auth.uid() = creator_id);

-- Criadores podem criar pedidos
CREATE POLICY "Creators can create payout requests" ON payout_requests 
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- Admins veem todos
CREATE POLICY "Admins can view all payout requests" ON payout_requests 
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Admins podem atualizar
CREATE POLICY "Admins can update payout requests" ON payout_requests 
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));
```

---

### 1.2 `creator_wallet`

**Descrição:** Carteira do criador com saldo disponível e pendente.

```sql
CREATE TABLE public.creator_wallet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL UNIQUE,    -- Referência ao criador
  balance_cents INTEGER DEFAULT 0,    -- Saldo disponível para saque
  pending_cents INTEGER DEFAULT 0,    -- Saldo reservado (saque em processamento)
  total_earned_cents INTEGER DEFAULT 0, -- Total já ganho
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Comportamento:**
- Quando criador solicita saque: `balance_cents -= valor`, `pending_cents += valor`
- Quando saque é pago: `pending_cents -= valor`
- Quando saque é rejeitado: `balance_cents += valor`, `pending_cents -= valor`

---

### 1.3 `profiles` (coluna affiliate_earnings)

**Descrição:** Saldo de afiliado armazenado no perfil do usuário.

```sql
-- Coluna relevante para saques:
affiliate_earnings INTEGER DEFAULT 0  -- Saldo de afiliado em centavos
```

**Comportamento:**
- Afiliados podem sacar via PIX assim como criadores
- O sistema debita de `affiliate_earnings` e/ou `creator_wallet.balance_cents`

---

### 1.4 `wallet_transactions` (Ledger)

**Descrição:** Log de todas as transações de carteira.

```sql
CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL,           -- ID do usuário/criador
  wallet_type TEXT NOT NULL,         -- 'creator' ou 'affiliate'
  type TEXT NOT NULL,                -- 'hold', 'release', 'refund', etc.
  amount_cents INTEGER NOT NULL,     -- Valor (negativo para débito)
  balance_after_cents INTEGER NOT NULL,
  reference_type TEXT,               -- 'payout_request'
  reference_id UUID,                 -- ID do payout_request
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Tipos de transação relacionados a saques:**
- `hold` - Valor reservado para saque pendente
- `release` - Valor liberado (saque confirmado)
- `refund` - Valor devolvido (saque falhou)

---

### 1.5 `transactions`

**Descrição:** Tabela geral de transações financeiras.

```sql
-- Registro de transação de saque
INSERT INTO transactions (
  user_id,
  type,           -- 'pix_withdraw' ou 'payout'
  status,         -- 'pending', 'completed', 'failed', 'cancelled'
  amount,
  external_id,    -- ID do payout_request
  metadata        -- Dados adicionais
);
```

---

### 1.6 `creator_bank_accounts` (LEGADO - não usado atualmente)

**Descrição:** Contas bancárias dos criadores (não usado no fluxo atual de PIX).

```sql
CREATE TABLE public.creator_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  bank_name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  account_number TEXT NOT NULL,
  routing_number TEXT NOT NULL,
  account_holder_name TEXT NOT NULL,
  document_number TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 2. CÓDIGO BACKEND

### 2.1 Controllers

#### `backend/src/controllers/withdrawalsController.ts` (Criador)

```typescript
// GET /api/withdrawals/wallet-summary
export const getWalletSummary = async (req, res, next) => {
  // Retorna balance_cents e pending_cents do criador
  const summary = await getCreatorWalletSummary(creatorId);
  return respondSuccess(res, 200, {
    balance_cents: summary.balanceCents,
    pending_cents: summary.pendingCents,
  });
};

// POST /api/withdrawals/request
export const createWithdrawal = async (req, res, next) => {
  // Cria solicitação de saque
  const { amount_cents, pix_key } = req.body;
  const result = await createWithdrawalRequest({ creatorId, amountCents, pixKey });
  // Retorna requestId, balance_cents_after, pending_cents_after
};

// GET /api/withdrawals/history
export const getPayoutHistory = async (req, res, next) => {
  // Lista histórico de saques do criador
  const payouts = await listCreatorPayoutRequests(creatorId);
};
```

#### `backend/src/controllers/adminPayoutsController.ts` (Admin)

```typescript
// GET /api/admin/payouts/pending
export const listPending = async (req, res, next) => {
  // Lista todos os saques pendentes para aprovação
  const pending = await listPendingPayoutRequests();
};

// POST /api/admin/payouts/:id/approve
export const approve = async (req, res, next) => {
  // Aprova um saque
  const result = await approvePayoutRequest({ requestId, adminId });
};

// POST /api/admin/payouts/:id/reject
export const reject = async (req, res, next) => {
  // Rejeita um saque e devolve saldo
  const { reason } = req.body;
  const result = await rejectPayoutRequest({ requestId, adminId, reason });
};
```

---

### 2.2 Services

#### `backend/src/services/creatorWithdrawalsService.ts`

```typescript
// Garante que wallet existe
const ensureWallet = async (creatorId: string) => {...};

// Retorna resumo da carteira
export const getCreatorWalletSummary = async (creatorId: string) => {
  return { balanceCents, pendingCents };
};

// Cria solicitação de saque
export const createWithdrawalRequest = async ({ creatorId, amountCents, pixKey }) => {
  // 1. Valida saldo suficiente
  // 2. Atualiza wallet: balance -= amount, pending += amount
  // 3. Insere em payout_requests com status 'pending'
  // 4. Retorna requestId e novos saldos
};

// Lista histórico de saques
export const listCreatorPayoutRequests = async (creatorId: string) => {...};
```

#### `backend/src/services/adminPayoutsService.ts`

```typescript
// Lista saques pendentes com dados bancários
export const listPendingPayoutRequests = async () => {
  // Busca payout_requests com status 'pending'
  // Inclui creator_bank_accounts e pix_key
};

// Aprova saque
export const approvePayoutRequest = async ({ requestId, adminId }) => {
  // 1. Valida status = pending
  // 2. Atualiza wallet: pending -= amount
  // 3. Atualiza payout_requests: status = 'approved'
};

// Rejeita saque
export const rejectPayoutRequest = async ({ requestId, adminId, reason }) => {
  // 1. Valida status = pending
  // 2. Atualiza wallet: balance += amount, pending -= amount
  // 3. Atualiza payout_requests: status = 'cancelled'
};
```

#### `backend/src/services/wooviPixService.ts` ⭐ INTEGRAÇÃO WOOVI

```typescript
import { getWooviConfig, WOOVI_CONSTANTS } from '../config/wooviConfig';

export type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM';

export interface WooviPixPaymentParams {
  userId: string;
  amountCents: number;
  pixKey: string;
  pixKeyType: PixKeyType;
  correlationId: string;
  comment?: string;
}

// Cria pagamento PIX via Woovi
export async function createPixPayment(params: WooviPixPaymentParams) {
  const config = getWooviConfig();
  
  const payload = {
    value: params.amountCents,
    destinationAlias: params.pixKey,
    destinationAliasType: params.pixKeyType,
    correlationID: params.correlationId,
    comment: params.comment || 'Saque Stream Live Hub',
  };

  const response = await fetch(`${config.baseUrl}/api/v1/payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': config.appId, // WOOVI_APP_ID
    },
    body: JSON.stringify(payload),
  });
  
  // Retorna { paymentId, status, rawResponse }
}

// Consulta status do pagamento
export async function getPixPaymentStatus(correlationId: string) {
  // GET /api/v1/payment/{correlationId}
}

// Detecta tipo de chave PIX
export function detectPixKeyType(pixKey: string): PixKeyType {
  if (/^\d{11}$/.test(cleanKey)) return 'CPF';
  if (/^\d{14}$/.test(cleanKey)) return 'CNPJ';
  if (/@/.test(cleanKey)) return 'EMAIL';
  if (/^\+?\d{10,13}$/.test(cleanKey)) return 'PHONE';
  return 'RANDOM';
}
```

#### `backend/src/config/wooviConfig.ts`

```typescript
export interface WooviConfig {
  appId: string;        // WOOVI_APP_ID
  baseUrl: string;      // https://api.openpix.com.br (prod) ou sandbox
  webhookSecret: string; // WOOVI_WEBHOOK_SECRET
  sandbox: boolean;      // WOOVI_SANDBOX === 'true'
}

export const WOOVI_CONSTANTS = {
  MIN_WITHDRAW_CENTS: 1500,   // R$ 15,00 mínimo
  API_TIMEOUT_MS: 30000,
  IDEMPOTENCY_WINDOW_SECONDS: 60,
};
```

---

### 2.3 Rotas

```typescript
// backend/src/routes/withdrawalsRoutes.ts
router.get('/wallet-summary', requireAuth, getWalletSummary);
router.get('/history', requireAuth, getPayoutHistory);
router.post('/request', requireAuth, withdrawalRateLimiter, createWithdrawal);

// backend/src/routes/adminPayoutsRoutes.ts
router.get('/payouts/pending', requireAuth, requireAdmin, listPending);
router.post('/payouts/:id/approve', requireAuth, requireAdmin, approve);
router.post('/payouts/:id/reject', requireAuth, requireAdmin, reject);

// backend/src/routes/creatorRoutes.ts (legado)
router.post('/creators/withdraw', requireAuth, requireCreatorAccount, submitWithdrawalController);
router.get('/creators/withdraw/history', requireAuth, requireCreatorAccount, getWithdrawalHistoryController);
```

---

## 3. CÓDIGO FRONTEND

### 3.1 Componentes de Saque

#### `src/components/PixWithdrawDialog.tsx`
- Dialog principal para solicitação de saque
- Suporta PIX e transferência bancária
- Fluxo: input → validate → confirm → success
- Chama Edge Function `pix-withdraw`

#### `src/components/creator/wallet/CreatorWalletPanel.tsx`
- Painel da carteira do criador
- Mostra saldo disponível e pendente
- Formulário simples de saque via PIX

### 3.2 Páginas Admin

#### `src/pages/AdminPixWithdrawals.tsx`
- Lista solicitações de saque PIX
- Filtros por status
- Ações: aprovar, rejeitar, marcar como pago

#### Componentes Admin:
- `src/components/admin/PixWithdrawalsTable.tsx`
- `src/components/admin/PixWithdrawalFilters.tsx`
- `src/components/admin/PixWithdrawalActionModal.tsx`

### 3.3 Services Frontend

#### `src/lib/pixWithdrawalsService.ts`
```typescript
// Busca saques PIX (admin)
export const fetchPixWithdrawals = async ({ status, page, pageSize }) => {
  // Query em 'transactions' com type = 'pix_withdrawal'
};

// Processa saque (aprovar/rejeitar/completar)
export const processPixWithdrawal = async (requestId, action, adminNotes) => {
  return supabase.functions.invoke("process-pix-payout", { body: {...} });
};
```

### 3.4 Hooks

#### `src/hooks/usePixWithdrawals.ts`
- Estado de filtros, paginação, modal
- Mutations para aprovar/rejeitar

---

## 4. INTEGRAÇÃO WOOVI ATUAL

### 4.1 Arquivos da Integração

| Arquivo | Descrição |
|---------|-----------|
| `backend/src/config/wooviConfig.ts` | Configuração (APP_ID, URLs) |
| `backend/src/services/wooviPixService.ts` | Chamadas à API Woovi |
| `supabase/functions/pix-withdraw/index.ts` | Edge Function de saque |
| `supabase/functions/woovi-payment-webhook/index.ts` | Webhook de confirmação |
| `supabase/config.toml` | Configuração de Edge Functions |

### 4.2 API Woovi Utilizada

**Endpoint de Criação de Pagamento (PIX Out):**
```
POST https://api.openpix.com.br/api/v1/payment
Headers:
  Content-Type: application/json
  Authorization: {WOOVI_APP_ID}

Body:
{
  "value": 5000,                     // Valor em centavos
  "destinationAlias": "123.456.789-00",  // Chave PIX
  "destinationAliasType": "CPF",     // Tipo da chave
  "correlationID": "uuid-único",     // ID de referência
  "comment": "Saque Stream Live Hub"
}

Response:
{
  "payment": {
    "value": 5000,
    "status": "CREATED",
    "correlationID": "uuid",
    "destinationAlias": "..."
  }
}
```

**Endpoint de Consulta:**
```
GET https://api.openpix.com.br/api/v1/payment/{correlationId}
```

### 4.3 Webhook Woovi

**URL:** `https://[PROJECT_ID].supabase.co/functions/v1/woovi-payment-webhook`

**Eventos:**
- `OPENPIX:MOVEMENT_CONFIRMED` - PIX confirmado
- `OPENPIX:MOVEMENT_FAILED` - PIX falhou

**Payload de Sucesso:**
```json
{
  "event": "OPENPIX:MOVEMENT_CONFIRMED",
  "payment": {
    "value": 3000,
    "status": "CONFIRMED",
    "correlationID": "uuid-do-saque"
  },
  "transaction": {
    "endToEndId": "E2311..."
  }
}
```

**Payload de Falha:**
```json
{
  "event": "OPENPIX:MOVEMENT_FAILED",
  "payment": {
    "status": "FAILED",
    "correlationID": "uuid-do-saque"
  },
  "error": {
    "code": "PAY_PIX_KEY_ERROR",
    "description": "Falha ao Pagar Chave Pix"
  }
}
```

---

## 5. FLUXO COMPLETO DE SAQUE

### 5.1 Diagrama de Fluxo

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLUXO DE SAQUE PIX                                │
└─────────────────────────────────────────────────────────────────────────────┘

CRIADOR                      SISTEMA                        WOOVI/PSP
   │                            │                              │
   │ 1. Solicita saque          │                              │
   │ ────────────────────────►  │                              │
   │                            │                              │
   │                            │ 2. Valida saldo              │
   │                            │ 3. Debita balance            │
   │                            │ 4. Adiciona pending          │
   │                            │ 5. Cria payout_request       │
   │                            │                              │
   │                            │ 6. (Se Woovi config)         │
   │                            │ ──────────────────────────►  │
   │                            │    POST /api/v1/payment      │
   │                            │                              │
   │                            │ ◄──────────────────────────  │
   │                            │    { status: "CREATED" }     │
   │                            │                              │
   │                            │ 7. Atualiza status           │
   │                            │    → 'approved'              │
   │                            │                              │
   │ 8. Recebe confirmação      │                              │
   │ ◄────────────────────────  │                              │
   │                            │                              │
   │                            │                              │
   │                            │ 9. (Webhook)                 │
   │                            │ ◄──────────────────────────  │
   │                            │   MOVEMENT_CONFIRMED         │
   │                            │                              │
   │                            │ 10. Atualiza status 'paid'   │
   │                            │ 11. Zera pending             │
   │                            │ 12. Notifica usuário         │
   │                            │                              │
   │ 13. Notificação final      │                              │
   │ ◄────────────────────────  │                              │
   │                            │                              │
```

### 5.2 Etapas Detalhadas

#### ETAPA 1: Solicitação (Frontend → Edge Function)
```typescript
// src/components/PixWithdrawDialog.tsx
const response = await supabase.functions.invoke("pix-withdraw", {
  body: {
    userId: creatorId,
    pixKey: "123.456.789-00",
    amountCents: 5000,
  },
});
```

#### ETAPA 2-5: Processamento (Edge Function)
```typescript
// supabase/functions/pix-withdraw/index.ts

// 2. Busca saldos
const { data: creatorWallet } = await supabase
  .from('creator_wallet')
  .select('balance_cents, pending_cents')
  .eq('creator_id', userId);

const totalAvailable = affiliateBalance + creatorBalance;

// 3-4. Debita saldos
await supabase.from('profiles').update({ 
  affiliate_earnings: newAffiliateBalance 
});
await supabase.from('creator_wallet').update({ 
  balance_cents: newCreatorBalance,
  pending_cents: newPending,
});

// 5. Cria payout_request
await supabase.from('payout_requests').insert({
  creator_id: userId,
  amount: amountCents,
  pix_key: pixKey,
  status: 'pending',
  idempotency_key: correlationId,
});
```

#### ETAPA 6-7: Integração Woovi (se configurado)
```typescript
// supabase/functions/pix-withdraw/index.ts
if (wooviEnabled) {
  const wooviResult = await processWooviPayment(
    wooviAppId,
    pixKey,
    keyType,
    amountCents,
    correlationId,
    payoutRequest.id
  );

  if (wooviResult.success) {
    await supabase.from('payout_requests').update({
      status: 'approved',
      psp_response: wooviResult.data,
    });
  }
}
```

#### ETAPA 9-12: Webhook de Confirmação
```typescript
// supabase/functions/woovi-payment-webhook/index.ts

if (event === 'OPENPIX:MOVEMENT_CONFIRMED') {
  // 10. Atualiza status
  await supabase.from('payout_requests').update({
    status: 'paid',
    paid_at: new Date().toISOString(),
  });

  // 11. Zera pending
  await supabase.from('creator_wallet').update({
    pending_cents: newPending,
  });

  // 12. Notifica usuário
  await supabase.from('notifications').insert({
    user_id: payout.creator_id,
    title: 'Saque concluído!',
    message: `Seu saque de R$ ${valor} foi depositado via PIX.`,
  });
}
```

---

## 6. VARIÁVEIS DE AMBIENTE

### 6.1 Secrets Configurados (Supabase)

| Secret | Descrição | Usado em |
|--------|-----------|----------|
| `WOOVI_APP_ID` | AppID da Woovi para autenticação | pix-withdraw, wooviPixService |
| `WOOVI_WEBHOOK_SECRET` | Secret para validar webhooks | woovi-payment-webhook |

### 6.2 Variáveis de Ambiente Backend

```bash
# Configuração Woovi (backend/src/config/wooviConfig.ts)
WOOVI_APP_ID=            # AppID da Woovi
WOOVI_WEBHOOK_SECRET=    # Secret do webhook
WOOVI_SANDBOX=true       # true para sandbox, false para produção
```

### 6.3 URLs da API Woovi

```typescript
// Produção
const WOOVI_BASE_URL = 'https://api.openpix.com.br';

// Sandbox
const WOOVI_SANDBOX_URL = 'https://api.woovi-sandbox.com';
```

---

## 7. REGRAS DE NEGÓCIO

### 7.1 Limites e Validações

| Regra | Valor | Arquivo |
|-------|-------|---------|
| **Valor mínimo de saque** | R$ 15,00 (1500 centavos) | `wooviConfig.ts`, `pix-withdraw/index.ts` |
| **Valor máximo** | Sem limite (apenas saldo disponível) | - |
| **Timeout API** | 30 segundos | `wooviConfig.ts` |
| **Rate Limit** | Via middleware | `withdrawalRateLimiter` |

### 7.2 Validação de Chave PIX

```typescript
// Tipos suportados
type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM';

// Detecção automática
if (/^\d{11}$/.test(cleanKey)) return 'CPF';
if (/^\d{14}$/.test(cleanKey)) return 'CNPJ';
if (/@/.test(cleanKey)) return 'EMAIL';
if (/^\+?\d{10,13}$/.test(cleanKey)) return 'PHONE';
return 'RANDOM';
```

### 7.3 Fluxo de Status

```
pending ──┬──► approved ──► paid
          │
          └──► rejected/cancelled
          
approved ──► failed (via webhook)
```

### 7.4 Taxas

- **Taxa de saque:** 0% (sem taxa)
- Criador recebe 100% do valor solicitado

### 7.5 Notificações

| Evento | Título | Tipo |
|--------|--------|------|
| Saque aprovado | "✅ Saque aprovado" | withdrawal_approved |
| Saque concluído | "💰 Saque realizado" | withdrawal_completed |
| Saque rejeitado | "❌ Saque rejeitado" | withdrawal_rejected |
| Saque falhou | "Saque falhou" | withdrawal |

---

## 8. PONTOS DE MODIFICAÇÃO PARA VELANA

### 8.1 Arquivos a Modificar

| Arquivo | Modificação Necessária |
|---------|------------------------|
| `backend/src/config/wooviConfig.ts` | Criar `velanaConfig.ts` ou adaptar |
| `backend/src/services/wooviPixService.ts` | Criar `velanaPixService.ts` |
| `supabase/functions/pix-withdraw/index.ts` | Trocar chamada Woovi → Velana |
| `supabase/functions/woovi-payment-webhook/index.ts` | Adaptar para webhook Velana |
| `supabase/config.toml` | Adicionar nova Edge Function se necessário |

### 8.2 Secrets a Adicionar

```bash
# Novos secrets para Velana
VELANA_API_KEY=          # Chave de API da Velana
VELANA_PUBLIC_KEY=       # Chave pública (se houver)
VELANA_WEBHOOK_SECRET=   # Secret para validar webhooks
VELANA_ENVIRONMENT=      # 'sandbox' ou 'production'
```

### 8.3 Comparação de APIs (template)

```markdown
| Aspecto | Woovi | Velana |
|---------|-------|--------|
| URL Base | api.openpix.com.br | ??? |
| Autenticação | Header Authorization: AppID | ??? |
| Endpoint PIX Out | POST /api/v1/payment | ??? |
| Status Sucesso | CONFIRMED | ??? |
| Status Falha | FAILED | ??? |
| Webhook Sucesso | OPENPIX:MOVEMENT_CONFIRMED | ??? |
| Webhook Falha | OPENPIX:MOVEMENT_FAILED | ??? |
```

### 8.4 Checklist de Migração

- [ ] Obter documentação da API Velana
- [ ] Criar `velanaConfig.ts` com nova configuração
- [ ] Criar `velanaPixService.ts` com mapeamento de API
- [ ] Modificar `pix-withdraw` Edge Function
- [ ] Criar/modificar webhook handler para Velana
- [ ] Adicionar secrets no Supabase
- [ ] Testar em sandbox
- [ ] Migrar para produção

---

## APÊNDICE A: Busca por "woovi" no código

### Arquivos que mencionam "woovi"

1. `backend/src/config/wooviConfig.ts` - Configuração
2. `backend/src/services/wooviPixService.ts` - Service de integração
3. `supabase/functions/pix-withdraw/index.ts` - Edge Function
4. `supabase/functions/woovi-payment-webhook/index.ts` - Webhook
5. `supabase/config.toml` - Configuração de Edge Functions
6. `src/components/PixWithdrawDialog.tsx` - Comentários sobre bancos

### Secrets relacionados

- `WOOVI_APP_ID` - Configurado ✅
- `WOOVI_WEBHOOK_SECRET` - Configurado ✅

---

## APÊNDICE B: Estrutura de Resposta da API

### Sucesso na solicitação de saque

```json
{
  "success": true,
  "payoutId": "uuid",
  "transactionId": "uuid",
  "status": "pending",
  "message": "Saque solicitado com sucesso",
  "automaticProcessing": false
}
```

### Erro na solicitação

```json
{
  "error": "Saldo insuficiente. Disponível: R$ 10,00"
}
```

### Webhook de confirmação

```json
{
  "received": true,
  "status": "paid"
}
```

---

**FIM DO RELATÓRIO**
