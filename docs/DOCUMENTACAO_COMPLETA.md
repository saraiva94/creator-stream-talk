# Stream Star - Documentação Técnica Completa

**Versão:** 2.0  
**Data:** 2025-01-30  
**Para:** Desenvolvedores (juniores e seniores)

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Como Rodar o Projeto](#2-como-rodar-o-projeto)
3. [Estrutura do Projeto](#3-estrutura-do-projeto)
4. [Banco de Dados (Supabase)](#4-banco-de-dados-supabase)
5. [Edge Functions](#5-edge-functions)
6. [Integrações](#6-integrações)
7. [Fluxos do Sistema](#7-fluxos-do-sistema)
8. [Credenciais e Acessos](#8-credenciais-e-acessos)
9. [Problemas Conhecidos e Soluções](#9-problemas-conhecidos-e-soluções)
10. [Contatos e Suporte](#10-contatos-e-suporte)
11. [Guia do Gestor (Admin)](#11-guia-do-gestor-admin)

---

## 1. Visão Geral

### O que é o Stream Star?

Uma plataforma de streaming ao vivo onde:
- **Criadores** fazem lives monetizadas
- **Viewers** compram créditos e consomem durante visualização (6 créditos/minuto)
- **Afiliados** ganham comissões indicando novos usuários
- **SuperChats** permitem destaque de mensagens com pagamento

### URL de Produção

| Ambiente | URL |
|----------|-----|
| **Produção** | https://streamstar.lovable.app |
| **Preview** | https://id-preview--3f92ff11-c725-4c41-b7e6-aaef0cf5370c.lovable.app |

### Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Estilização** | Tailwind CSS + shadcn/ui |
| **Estado** | TanStack Query + React Context |
| **Backend** | Supabase Edge Functions (Deno) |
| **Banco de Dados** | PostgreSQL (Supabase) |
| **Autenticação** | Supabase Auth (JWT) |
| **Streaming** | LiveKit Cloud (WebRTC) |
| **Pagamentos PIX** | Velana (cash-in e cash-out) |
| **Hospedagem** | Lovable Cloud |

### Diagrama de Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React SPA)                          │
│  Pages → Components → Hooks → Contexts → Lib                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                    HTTP / WebSocket / WebRTC
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE (Lovable Cloud)                      │
│  Database │ Auth │ Realtime │ Storage │ Edge Functions          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SERVIÇOS EXTERNOS                             │
│         LiveKit (WebRTC)    │    Velana (PIX)                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Como Rodar o Projeto

### Pré-requisitos

- Node.js 18+ (recomendado instalar via [nvm](https://github.com/nvm-sh/nvm))
- npm ou bun
- Acesso ao repositório Git

### Instalação Passo a Passo

```bash
# 1. Clonar o repositório
git clone <URL_DO_REPOSITORIO>
cd stream-star

# 2. Instalar dependências do frontend
npm install

# 3. Copiar variáveis de ambiente
cp .env.example .env
# Preencher com valores reais (ver seção de Variáveis de Ambiente)

# 4. Rodar o frontend
npm run dev
# Acesse http://localhost:5173

# 5. (Opcional) Rodar backend Node auxiliar
cd backend
npm install
npm run dev
# Roda em http://localhost:4000
```

### Variáveis de Ambiente (Lista Completa)

#### Frontend (.env)

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `VITE_SUPABASE_URL` | URL do projeto Supabase | `https://xxx.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave pública (anon key) | `eyJ...` |
| `VITE_SUPABASE_PROJECT_ID` | ID do projeto | `enacciilzvifhqpenhlz` |
| `VITE_SITE_URL` | URL pública do frontend | `https://streamstar.lovable.app` |
| `VITE_API_URL` | URL do backend Node (se usar) | `http://localhost:4000` |
| `VITE_USE_LIVEKIT` | Ativar LiveKit WebRTC | `true` |

#### Secrets do Supabase (Edge Functions)

| Secret | Descrição | Obrigatório |
|--------|-----------|-------------|
| `SUPABASE_URL` | URL do Supabase | ✅ |
| `SUPABASE_ANON_KEY` | Chave anônima | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service role | ✅ |
| `LIVEKIT_URL` | URL do LiveKit Cloud | ✅ |
| `LIVEKIT_API_KEY` | API Key do LiveKit | ✅ |
| `LIVEKIT_API_SECRET` | Secret do LiveKit | ✅ |
| `VELANA_API_KEY` | API Key da Velana | ✅ |
| `VELANA_TRANSFER_SECRET` | Secret para transferências PIX | ✅ |
| `RESEND_API_KEY` | API Key do Resend (emails) | Opcional |

### Deploy

1. **Lovable Cloud**: Push para o repositório → deploy automático
2. **Edge Functions**: Deploy automático via Lovable Cloud
3. **Variáveis de produção**: Configurar no dashboard do Lovable

---

## 3. Estrutura do Projeto

### Pastas Principais

```
📁 projeto/
├── 📁 src/                          ← FRONTEND REACT
│   ├── 📁 components/               ← Componentes reutilizáveis
│   │   ├── 📁 ui/                   ← Primitivas shadcn/ui (Button, Card, Dialog)
│   │   ├── 📁 chat/                 ← Chat e mensagens
│   │   ├── 📁 admin/                ← Painel administrativo
│   │   ├── 📁 creator/              ← Área do criador (dashboard, wallet)
│   │   ├── 📁 webrtc/               ← WebRTCPublisher e WebRTCViewer
│   │   └── 📁 live/                 ← Componentes de live streaming
│   ├── 📁 pages/                    ← Páginas (cada arquivo = uma rota)
│   ├── 📁 hooks/                    ← Custom hooks (useAuth, useLanguage)
│   ├── 📁 contexts/                 ← React Contexts (AuthContext, CreditsContext)
│   ├── 📁 lib/                      ← Utilitários e services
│   └── 📁 integrations/supabase/    ← Cliente e tipos do Supabase
│
├── 📁 supabase/
│   ├── 📁 functions/                ← EDGE FUNCTIONS (backend Deno)
│   │   ├── create-velana-payment/   ← Criar pagamento PIX
│   │   ├── velana-webhook/          ← Receber confirmação de pagamento
│   │   ├── pix-withdraw/            ← Solicitar saque PIX
│   │   ├── livekit-room/            ← Gerar token LiveKit
│   │   └── ...                      ← Outras functions
│   └── config.toml                  ← Configuração das functions
│
├── 📁 backend/                      ← BACKEND NODE (auxiliar/legado)
│   └── 📁 src/
│       ├── 📁 controllers/          ← Handlers HTTP
│       ├── 📁 services/             ← Lógica de negócio
│       └── 📁 routes/               ← Definição de rotas
│
├── 📁 docs/                         ← DOCUMENTAÇÃO
└── 📁 public/                       ← Arquivos estáticos
```

### Arquivos Importantes

| Arquivo | O que faz |
|---------|-----------|
| `src/App.tsx` | Rotas e providers da aplicação |
| `src/contexts/AuthContext.tsx` | Estado de autenticação |
| `src/contexts/CreditsContext.tsx` | Estado de créditos do usuário |
| `src/integrations/supabase/client.ts` | Cliente Supabase (NÃO EDITAR) |
| `src/integrations/supabase/types.ts` | Tipos do banco (NÃO EDITAR) |
| `src/index.css` | Design tokens (cores, fontes) |
| `tailwind.config.ts` | Configuração do Tailwind |

---

## 4. Banco de Dados (Supabase)

### Tabelas Principais

| Tabela | Descrição | Campos Importantes |
|--------|-----------|-------------------|
| `profiles` | Perfis de usuário | `username`, `referral_code`, `affiliate_earnings`, `status` |
| `creator_profiles` | Perfis públicos de criadores | `display_name`, `approved_for_live`, `is_streaming` |
| `credits_wallet` | Carteira de créditos do viewer | `user_id`, `balance_credits` |
| `creator_wallet` | Carteira do criador (centavos) | `creator_id`, `balance_cents`, `pending_cents` |
| `lives` | Lives criadas | `creator_id`, `status`, `webrtc_room_name`, `is_active` |
| `live_consumption` | Consumo de créditos por sessão | `live_id`, `user_id`, `credits_consumed`, `seconds_watched` |
| `live_access` | Acessos concedidos a lives | `live_id`, `user_id`, `status` |
| `creator_earnings` | Ganhos do criador por live | `live_id`, `creator_amount_cents`, `platform_amount_cents` |
| `payout_requests` | Solicitações de saque | `creator_id`, `amount`, `status`, `pix_key` |
| `transactions` | Histórico geral de transações | `type`, `amount`, `status`, `user_id` |
| `registration_referrals` | Cadastros pendentes com referral | `email`, `referrer_id`, `status`, `password_hash` |
| `affiliate_logs` | Log de comissões distribuídas | `direct_referrer`, `amount_direct`, `amount_root` |
| `platform_revenue` | Receita da plataforma | `source_type`, `amount`, `metadata` |
| `user_roles` | Roles (admin/creator/viewer) | `user_id`, `role` |
| `superchats` | SuperChats enviados | `room_id`, `amount`, `tier`, `message` |
| `messages` | Mensagens de chat | `room_id`, `user_id`, `content` |
| `payment_intents` | Intenções de pagamento Velana | `user_id`, `status`, `purchase_type` |

### Funções RPC Disponíveis

| Função | Parâmetros | O que faz |
|--------|------------|-----------|
| `has_role(user_id, role)` | UUID, TEXT | Verifica se usuário tem role |
| `increment_balance(user_id, amount)` | UUID, NUMERIC | Incrementa saldo do profile |
| `increment_affiliate_earnings(profile_id, cents)` | UUID, INTEGER | Incrementa ganhos de afiliado |
| `increment_creator_wallet(creator_id, cents)` | UUID, INTEGER | Incrementa carteira do criador |
| `get_or_create_creator_wallet(creator_id)` | UUID | Obtém ou cria carteira |
| `validate_referral_code(code)` | TEXT | Valida código de referral |

### Políticas de Segurança (RLS)

Todas as tabelas têm Row Level Security habilitado:
- Usuários só veem seus próprios dados
- Admins têm acesso total (via `has_role`)
- Service role bypassa RLS (usado nas Edge Functions)

---

## 5. Edge Functions

### Lista Completa

| Function | O que faz | Auth |
|----------|-----------|------|
| `create-velana-payment` | Criar pagamento PIX (cash-in) | Não |
| `velana-webhook` | Receber confirmação de pagamento | Não |
| `registration-checkout` | Checkout de cadastro com pagamento | Não |
| `pix-withdraw` | Solicitar saque PIX (cash-out) | JWT |
| `livekit-room` | Gerar token JWT para LiveKit | Não |
| `login-with-credential` | Login com nickname ou email | Não |
| `monitor-lives` | Cron de monitoramento de lives | Não |
| `viewer-heartbeat` | Heartbeat de viewer (consumo) | Não |
| `credits-balance` | Consultar saldo de créditos | JWT |
| `admin-create-user` | Criar usuário via admin | Service Role |
| `admin-set-password` | Definir senha de usuário | Service Role |
| `auth-email-hook` | Hook para emails de auth | Não |
| `password-reset` | Reset de senha customizado | Não |
| `process-pix-payout` | Admin: processar payout | JWT |
| `reconcile-transfers` | Reconciliar transferências | Admin |
| `backfill-platform-revenue` | Preencher receita histórica | Admin |

### Exemplo: Estrutura de uma Edge Function

```typescript
// supabase/functions/minha-function/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Criar cliente Supabase
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Sua lógica aqui...
    const body = await req.json();

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

---

## 6. Integrações

### 6.1 Velana (Pagamentos PIX)

A Velana é o gateway de pagamentos PIX para cash-in (receber) e cash-out (enviar).

#### Cash-In (Receber Pagamentos)

**Edge Function:** `create-velana-payment`

**Como funciona:**
1. Frontend chama a Edge Function com `purchaseType` (credits, registration, superchat)
2. Function cria `payment_intent` no banco
3. Function chama API Velana para gerar QR Code PIX
4. Retorna QR Code para o frontend
5. Usuário paga via PIX
6. Velana envia webhook para `velana-webhook`
7. Webhook atualiza `payment_intent` e processa conforme tipo

**Dados fixos para cash-in:**
- Nome: `Stream Star Pagamentos`
- CPF: `10285418726`
- Phone: `12999999999`

**Tipos de compra:**
| Tipo | Valor | O que acontece |
|------|-------|----------------|
| `credits` | Variável | Adiciona créditos à `credits_wallet` |
| `registration` | R$ 7,00 | Cria conta + distribui comissões |
| `superchat` | R$ 3-8 | Insere superchat na fila |

#### Cash-Out (Enviar Pagamentos)

**Edge Function:** `pix-withdraw`

**Como funciona:**
1. Criador solicita saque com `pixKey` e `amount`
2. Function valida saldo e chave PIX
3. Debita `balance_cents`, adiciona em `pending_cents`
4. Chama API Velana `POST /v1/transfers`
5. Cria registro em `payout_requests`
6. Velana processa transferência

**Autenticação Velana:**
- Basic Auth: `VELANA_API_KEY:x`
- Body inclui: `VELANA_TRANSFER_SECRET`

**Taxas:**
- Taxa de saque: R$ 5,00 por transação
- Mínimo de saque: R$ 5,00
- Saldo mínimo na conta: R$ 15,00

### 6.2 LiveKit (Streaming WebRTC)

LiveKit fornece streaming de vídeo ao vivo via WebRTC.

**Componentes:**
- `WebRTCPublisher.tsx` - Criador transmite
- `WebRTCViewer.tsx` - Viewer assiste

**Edge Function:** `livekit-room`
- Gera tokens JWT para host e viewer
- Host tokens requerem autenticação
- Viewer tokens permitem acesso spectator

**Fluxo:**
1. Criador clica "Ficar Online" (single-step)
2. Frontend cria live no banco
3. `livekit-room` gera token de host
4. `WebRTCPublisher` conecta no LiveKit
5. Viewer acessa e vê 20s de preview
6. Se tem créditos: heartbeat inicia consumo

**Secrets necessários:**
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

### 6.3 Supabase

| Serviço | Uso |
|---------|-----|
| **Auth** | Login/registro com JWT, reset de senha |
| **Database** | PostgreSQL com RLS |
| **Realtime** | Chat ao vivo, atualizações de status |
| **Storage** | Avatares, thumbnails (buckets: `avatars`, `live-thumbnails`, `chat-media`) |
| **Edge Functions** | Backend serverless (Deno) |

---

## 7. Fluxos do Sistema

### 7.1 Fluxo de Cadastro com Pagamento

```
1. Usuário acessa /subscribe?ref=CODE
2. Valida código de afiliado
3. Preenche formulário (nome, email, senha, nickname)
4. registration-checkout cria registration_referrals (pending)
5. create-velana-payment gera QR Code PIX
6. Usuário paga R$ 7,00
7. velana-webhook:
   - Cria usuário no Supabase Auth
   - Distribui comissões (R$1 pai, R$0.50 avô)
   - Atualiza status para completed
8. Usuário faz login
```

### 7.2 Fluxo de Compra de Créditos

```
1. Usuário seleciona pacote de créditos
2. Frontend chama create-velana-payment
3. Retorna QR Code PIX
4. Usuário paga
5. velana-webhook:
   - Insere em credit_purchases
   - Incrementa credits_wallet.balance_credits
```

**Pacotes disponíveis:**
| Créditos | Valor | Tempo de Live |
|----------|-------|---------------|
| 180 | R$ 5,00 | ~30 min |
| 360 | R$ 9,00 | ~1 hora |
| 720 | R$ 16,00 | ~2 horas |
| 1800 | R$ 35,00 | ~5 horas |

**Conversão:** 180 créditos = R$ 5,00 | 6 créditos/minuto

### 7.3 Fluxo de Saque PIX

```
1. Criador acessa painel de wallet
2. Informa chave PIX e valor
3. pix-withdraw valida:
   - Saldo >= valor + taxa (R$ 5,00)
   - Chave PIX válida
4. Debita balance_cents
5. Chama API Velana para transferência
6. Cria payout_requests (status: processing)
7. Velana processa e transfere
8. Atualiza status para paid
```

### 7.4 Fluxo de SuperChat

```
1. Viewer escolhe tier (Blue/Yellow/Red)
2. Escreve mensagem
3. create-velana-payment gera PIX
4. Viewer paga
5. velana-webhook:
   - Insere superchat (status: pending)
   - 80% para creator_wallet
   - 20% para plataforma
6. Criador vê na fila e exibe
```

**Tiers:**
| Tier | Valor | Duração |
|------|-------|---------|
| Blue | R$ 3,00 | 60s |
| Yellow | R$ 5,00 | 120s |
| Red | R$ 8,00 | 180s |

### 7.5 Fluxo de Afiliados

```
1. Usuário gera link: /subscribe?ref={referral_code}
2. Novo usuário clica no link
3. registration_referrals guarda referrer_id e referrer_parent_id
4. Após pagamento:
   - Pai (direto): recebe R$ 1,00
   - Avô (root): recebe R$ 0,50 (se diferente do pai)
   - affiliate_logs registra comissão
   - profiles.affiliate_earnings incrementa
```

### 7.6 Fluxo de Live Streaming

```
1. Criador clica "Ficar Online"
2. Frontend cria live no banco (status: live)
3. livekit-room gera token de host
4. WebRTCPublisher conecta no LiveKit
5. Viewer acessa página da live
6. 20s de preview (blur + mute)
7. Se tem créditos: viewer-heartbeat inicia
8. A cada 10s: debita 1 crédito
9. Criador encerra: settlement calcula ganhos
10. 80% para creator_wallet, 20% para plataforma
```

---

## 8. Credenciais e Acessos

### Serviços que o Dev Precisa Acesso

| Serviço | O que precisa | Como conseguir |
|---------|---------------|----------------|
| **Lovable** | Acesso ao projeto | Convite como colaborador |
| **GitHub** | Repositório | Convite como colaborador |
| **LiveKit** | Dashboard e API keys | https://cloud.livekit.io |
| **Velana** | Dashboard e API keys | Portal Velana |
| **Resend** | API key para emails | https://resend.com |

### Onde Configurar Credenciais

| Tipo | Onde configurar |
|------|-----------------|
| Variáveis VITE_* | `.env` na raiz do projeto |
| Secrets das Edge Functions | Dashboard do Lovable Cloud |
| API keys externas | Dashboards dos respectivos serviços |

### Contas Admin Existentes

Consultar tabela `user_roles` para ver admins cadastrados:
```sql
SELECT p.username, p.email, ur.role 
FROM user_roles ur 
JOIN profiles p ON p.id = ur.user_id 
WHERE ur.role = 'admin';
```

---

## 9. Problemas Conhecidos e Soluções

### 9.1 Secret da Velana Truncado

**Problema:** Variáveis de ambiente longas são truncadas no Supabase.

**Solução:** Hardcode do secret como fallback nas Edge Functions:
```typescript
const transferSecret = Deno.env.get("VELANA_TRANSFER_SECRET") || "CHAVE_COMPLETA_AQUI";
```

### 9.2 Login com Nickname Falhava

**Problema:** Tentava resolver nickname no frontend, falhava.

**Solução:** Edge Function `login-with-credential` resolve server-side:
1. Busca email por nickname na tabela `profiles`
2. Busca email real via Supabase Auth Admin API
3. Faz `signInWithPassword` com email
4. Retorna tokens

### 9.3 Password Reset para Domínio Errado

**Problema:** Links de reset iam para preview domain.

**Solução:** `getSiteUrl()` força domínio de produção:
```typescript
// src/lib/siteUrl.ts
export function getSiteUrl() {
  return "https://streamstar.lovable.app";
}
```

### 9.4 Velana Cash-In Payload Variável

**Problema:** Estrutura do payload Velana varia entre chamadas.

**Solução:** Checar múltiplos caminhos:
```typescript
const qrCode = data?.pix?.qrcode || data?.payload?.data?.pix?.qrcode;
```

### 9.5 Contas Admin sem Registro em registration_referrals

**Problema:** Admins criados via `admin-create-user` não tinham registro, login por nickname falhava.

**Solução:** 
- `login-with-credential` busca primeiro em `profiles` diretamente
- Fallback query não depende de `registration_referrals`

### 9.6 Payload Velana para Transferências

**Problema:** API Velana espera formato específico para transferências.

**Solução:** Usar Basic Auth + secret no body:
```typescript
// Autenticação
headers: {
  'Authorization': `Basic ${btoa(VELANA_API_KEY + ':x')}`,
  'Content-Type': 'application/json'
}

// Body
{
  "amount": 1000,
  "pixKey": "12345678901",
  "secret": VELANA_TRANSFER_SECRET
}
```

---

## 10. Contatos e Suporte

### Documentação Oficial

| Serviço | URL |
|---------|-----|
| **Supabase** | https://supabase.com/docs |
| **LiveKit** | https://docs.livekit.io |
| **Velana** | Portal/documentação da Velana |
| **Lovable** | https://docs.lovable.dev |
| **Tailwind CSS** | https://tailwindcss.com/docs |
| **shadcn/ui** | https://ui.shadcn.com |

### Fórmulas de Negócio

| Fórmula | Cálculo |
|---------|---------|
| Créditos por minuto | 6 créditos/min (0.1 crédito/10s) |
| Conversão | 180 créditos = R$ 5,00 (500 centavos) |
| Receita por crédito | (credits / 180) × 500 centavos |
| Split criador | 80% da receita |
| Split plataforma | 20% da receita |
| Comissão afiliado direto | R$ 1,00 (100 centavos) |
| Comissão afiliado avô | R$ 0,50 (50 centavos) |
| Taxa de saque | R$ 5,00 por transação |
| Mínimo de saque | R$ 5,00 |
| Saldo mínimo para saque | R$ 15,00 |

---

## 11. Guia do Gestor (Admin)

Esta seção é para administradores não-técnicos que precisam operar o painel.

### Papéis do Sistema

| Papel | O que faz |
|-------|-----------|
| **Usuário** | Compra créditos e assiste lives |
| **Criador** | Faz lives e recebe parte dos créditos consumidos |
| **Admin** | Aprova criadores, libera/nega saques, acompanha receita |

### Operações do Painel Admin

| Ação | Rota | Descrição |
|------|------|-----------|
| **Aprovar criadores** | `/admin/creators` | Ver lista de criadores e Aprovar/Revogar permissão de live |
| **Processar saques** | `/admin/payouts` | Ver solicitações pendentes e aprovar/rejeitar pagamentos |
| **Ver receita** | Dashboard admin | Conferir métricas e pagamentos da plataforma |

### Fluxo do Dinheiro (Simplificado)

1. **Usuário** compra créditos (PIX)
2. Cada período na live **consome créditos**
3. **80%** vira saldo do criador, **20%** fica com a plataforma
4. **Criador** solicita saque
5. **Admin** aprova ou rejeita o saque
6. **Afiliados** ganham R$1,00 (direto) + R$0,50 (avô) quando trazem novos usuários

### Passo a Passo Rápido

| Tarefa | Como fazer |
|--------|------------|
| Liberar criador para live | Acessar `/admin/creators` → clicar em "Aprovar" |
| Pagar saque de criador | Ir em `/admin/payouts` → clicar em "Aprovar" |
| Ver afiliados funcionando | Pedir que um usuário copie seu link em Profile, criar novo usuário via link, verificar comissão |
| Testar como usuário | Comprar créditos, entrar em live, ver créditos sendo consumidos |

---

## Checklist de Handoff

- [ ] Novo dev tem acesso ao repositório GitHub
- [ ] Novo dev tem acesso ao Lovable
- [ ] Credenciais de serviços externos compartilhadas de forma segura
- [ ] Ambiente local funcionando (`npm run dev`)
- [ ] Leu toda esta documentação
- [ ] Entende os fluxos de pagamento PIX
- [ ] Entende o sistema de afiliados
- [ ] Entende o streaming LiveKit
- [ ] Testou login/cadastro no ambiente de preview

---

*Documento consolidado em 2025-01-30. Manter atualizado conforme evolução do projeto.*
