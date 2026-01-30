# 📋 STREAM STAR - PROJECT DOCUMENTATION REFERENCE (PDR)

**Versão:** 1.0  
**Data:** 2025-01-30  
**Para:** Handoff de desenvolvedor

---

## 📑 Índice

1. [Visão Geral do Projeto](#1-visão-geral-do-projeto)
2. [Arquitetura Técnica](#2-arquitetura-técnica)
3. [Configuração do Ambiente](#3-configuração-do-ambiente)
4. [Integrações Externas](#4-integrações-externas)
5. [Funcionalidades Principais](#5-funcionalidades-principais)
6. [Edge Functions](#6-edge-functions)
7. [Banco de Dados](#7-banco-de-dados)
8. [Fluxos Críticos](#8-fluxos-críticos)
9. [Credenciais e Acessos](#9-credenciais-e-acessos)
10. [Problemas Conhecidos e Soluções](#10-problemas-conhecidos-e-soluções)
11. [Documentação Relacionada](#11-documentação-relacionada)

---

## 1. Visão Geral do Projeto

### Nome
**Stream Star** (anteriormente Creator Stream Talk / Stream Live Hub)

### Descrição
Plataforma de streaming ao vivo onde criadores de conteúdo fazem transmissões e espectadores pagam com créditos para assistir. Inclui sistema de afiliados com comissões em dois níveis.

### Objetivo
- Permitir criadores fazerem lives monetizadas
- Viewers compram créditos e consomem durante visualização
- Sistema de afiliados para crescimento orgânico
- SuperChats para interação com destaque

### URLs de Produção
| Ambiente | URL |
|----------|-----|
| **Produção (Lovable)** | https://streamstar.lovable.app |
| **Preview (Lovable)** | https://id-preview--3f92ff11-c725-4c41-b7e6-aaef0cf5370c.lovable.app |
| **Supabase Project ID** | `enacciilzvifhqpenhlz` |

---

## 2. Arquitetura Técnica

### Stack Principal

| Camada | Tecnologia |
|--------|------------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Estilização** | Tailwind CSS + shadcn/ui |
| **Estado** | TanStack Query + React Context |
| **Backend** | Supabase (Edge Functions em Deno) |
| **Banco de Dados** | PostgreSQL (Supabase) |
| **Autenticação** | Supabase Auth (JWT) |
| **Streaming** | LiveKit Cloud (WebRTC) |
| **Pagamentos Cash-In** | Velana PIX |
| **Pagamentos Cash-Out** | Velana PIX (transferências) |
| **Hospedagem** | Lovable Cloud / Vercel |

### Diagrama de Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React SPA)                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Pages     │  │ Components  │  │   Hooks     │  │  Contexts   │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                         HTTP/WebSocket/WebRTC
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SUPABASE (Lovable Cloud)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  Database   │  │    Auth     │  │  Realtime   │  │   Storage   │    │
│  │   (SQL)     │  │   (JWT)     │  │ (WebSocket) │  │   (Files)   │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Edge Functions (Deno)                         │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       SERVIÇOS EXTERNOS                                  │
│  ┌─────────────┐  ┌─────────────┐                                       │
│  │  LiveKit    │  │   Velana    │                                       │
│  │  (WebRTC)   │  │    (PIX)    │                                       │
│  └─────────────┘  └─────────────┘                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Estrutura de Pastas

```
📁 projeto/
├── 📁 src/                          ← FRONTEND REACT
│   ├── 📁 components/               ← Componentes reutilizáveis
│   │   ├── 📁 ui/                   ← Primitivas shadcn/ui
│   │   ├── 📁 chat/                 ← Chat e mensagens
│   │   ├── 📁 admin/                ← Painel administrativo
│   │   ├── 📁 creator/              ← Área do criador
│   │   ├── 📁 webrtc/               ← WebRTCPublisher/Viewer (LiveKit)
│   │   └── 📁 live/                 ← Componentes de live
│   ├── 📁 pages/                    ← Páginas (rotas)
│   ├── 📁 hooks/                    ← Custom hooks
│   ├── 📁 contexts/                 ← React Contexts
│   ├── 📁 lib/                      ← Utilitários e serviços
│   └── 📁 integrations/supabase/    ← Cliente e tipos Supabase
│
├── 📁 supabase/
│   ├── 📁 functions/                ← EDGE FUNCTIONS (backend Deno)
│   └── config.toml                  ← Configuração das functions
│
├── 📁 backend/                      ← BACKEND NODE (legado/auxiliar)
│   ├── 📁 src/controllers/
│   ├── 📁 src/services/
│   ├── 📁 src/routes/
│   └── 📁 src/lib/
│
├── 📁 docs/                         ← DOCUMENTAÇÃO
├── 📁 public/                       ← Arquivos estáticos
└── 📄 index.html                    ← Entrada HTML
```

---

## 3. Configuração do Ambiente

### Variáveis de Ambiente (Frontend)

```env
# Supabase
VITE_SUPABASE_URL="https://[PROJECT_ID].supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJ..."
VITE_SUPABASE_PROJECT_ID="[PROJECT_ID]"

# Frontend
VITE_SITE_URL="https://streamstar.lovable.app"
VITE_API_URL="[URL_BACKEND_SE_APLICAVEL]"

# LiveKit
VITE_USE_LIVEKIT="true"
```

### Secrets do Supabase (Edge Functions)

```
# Supabase Internos
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_DB_URL

# LiveKit WebRTC
LIVEKIT_URL
LIVEKIT_API_KEY
LIVEKIT_API_SECRET

# Velana PIX
VELANA_API_KEY
VELANA_TRANSFER_SECRET

# Email
RESEND_API_KEY

# Legado (não mais usados ativamente)
MERCADOPAGO_ACCESS_TOKEN
MERCADOPAGO_PUBLIC_KEY
MERCADOPAGO_WEBHOOK_SECRET
```

### Como Rodar Localmente

```bash
# 1. Clonar repositório
git clone [URL_REPOSITORIO]
cd [NOME_PROJETO]

# 2. Instalar dependências frontend
npm install

# 3. Copiar variáveis de ambiente
cp .env.example .env
# Preencher com valores reais

# 4. Rodar frontend
npm run dev

# 5. (Opcional) Rodar backend Node auxiliar
cd backend
npm install
npm run dev
```

### Como Fazer Deploy

1. **Lovable Cloud**: Push para repositório → deploy automático
2. **Vercel** (se configurado): Push → build → deploy
3. **Edge Functions**: Deploy automático via Lovable Cloud

---

## 4. Integrações Externas

### 4.1 Supabase (Lovable Cloud)

| Serviço | Uso |
|---------|-----|
| **Auth** | Login/registro com JWT, reset de senha |
| **Database** | PostgreSQL com RLS |
| **Realtime** | Chat ao vivo, atualizações de status |
| **Storage** | Avatares, thumbnails, mídia de chat |
| **Edge Functions** | Backend serverless (Deno) |

**URL Base:** `https://enacciilzvifhqpenhlz.supabase.co`

### 4.2 LiveKit (WebRTC Streaming)

| Configuração | Descrição |
|--------------|-----------|
| **LIVEKIT_URL** | URL do servidor LiveKit Cloud |
| **LIVEKIT_API_KEY** | Chave da API |
| **LIVEKIT_API_SECRET** | Secret para gerar tokens JWT |

**Componentes:**
- `WebRTCPublisher.tsx` - Criador transmite
- `WebRTCViewer.tsx` - Viewer assiste
- Edge Function `livekit-room` gera tokens

### 4.3 Velana (Pagamentos PIX)

| Tipo | Endpoint | Descrição |
|------|----------|-----------|
| **Cash-In** | `create-velana-payment` | Receber pagamentos PIX |
| **Cash-Out** | `pix-withdraw` | Enviar transferências PIX |
| **Webhook** | `velana-webhook` | Confirmação de pagamentos |

**Dados Fixos para Cash-In:**
- Nome: `Stream Star Pagamentos`
- CPF: `10285418726`
- Phone: `12999999999`

**Autenticação Cash-Out:**
- Basic Auth: `VELANA_API_KEY:x`
- Body inclui: `VELANA_TRANSFER_SECRET`

### 4.4 Resend (Email)

Usado para emails transacionais (via Supabase Auth hooks).

---

## 5. Funcionalidades Principais

### 5.1 Autenticação

| Feature | Implementação |
|---------|---------------|
| Login | Email/senha ou nickname via Supabase Auth |
| Registro | Com pagamento PIX obrigatório (paywall R$ 7,00) |
| Reset de Senha | Supabase Auth nativo |
| Roles | admin, creator, viewer (tabela `user_roles`) |

**Login com Nickname:**
- Edge Function `login-with-credential` resolve nickname → email
- Usa `signInWithPassword` do Supabase Auth

### 5.2 Cadastro com Pagamento PIX

| Passo | Descrição |
|-------|-----------|
| 1 | Usuário preenche formulário + código de afiliado |
| 2 | `registration-checkout` valida e cria `registration_referrals` |
| 3 | `create-velana-payment` gera PIX |
| 4 | Usuário paga via QR Code |
| 5 | `velana-webhook` confirma, cria conta Supabase Auth |
| 6 | Distribui comissões de afiliado |

**Valor:** R$ 7,00 (configurável)

### 5.3 Compra de Créditos

| Pacote | Créditos | Valor | Tempo de Live |
|--------|----------|-------|---------------|
| Básico | 180 | R$ 5,00 | ~30 min |
| Médio | 360 | R$ 9,00 | ~1 hora |
| Grande | 720 | R$ 16,00 | ~2 horas |
| Premium | 1800 | R$ 35,00 | ~5 horas |

**Conversão:** 180 créditos = R$ 5,00 | 6 créditos/minuto

### 5.4 SuperChat

| Tier | Valor | Duração | Cor |
|------|-------|---------|-----|
| Blue | R$ 3,00 | 60s | Azul |
| Yellow | R$ 5,00 | 120s | Amarelo |
| Red | R$ 8,00 | 180s | Vermelho |

### 5.5 Saques PIX (Criadores)

| Status | Descrição |
|--------|-----------|
| pending | Aguardando processamento |
| processing | Em transferência |
| paid | Concluído |
| failed | Falhou (saldo devolvido) |
| rejected | Rejeitado por admin |

**Mínimo:** R$ 5,00 | **Saldo mínimo na conta:** R$ 15,00

### 5.6 Sistema de Afiliados

| Nível | Comissão | Descrição |
|-------|----------|-----------|
| Direto (Pai) | R$ 1,00 | Quem compartilhou o link |
| Raiz (Avô) | R$ 0,50 | Quem indicou o pai |
| Plataforma | Restante | R$ 5,50 |

### 5.7 Lives/Streaming (LiveKit WebRTC)

| Feature | Descrição |
|---------|-----------|
| Go Live | Single-step (clique único) |
| Paywall | 20 segundos preview, depois blur + mute |
| Heartbeat | A cada 10s, debita créditos |
| Settlement | Ao encerrar, 80% criador / 20% plataforma |

---

## 6. Edge Functions

### Lista Completa

| Function | Propósito | Auth |
|----------|-----------|------|
| `admin-create-user` | Criar usuário admin | service_role |
| `admin-set-password` | Definir senha de usuário | service_role |
| `auth-email-hook` | Hook para emails de auth | no |
| `backfill-platform-revenue` | Preencher receita histórica | admin |
| `create-velana-payment` | Criar pagamento PIX (cash-in) | no |
| `credits-balance` | Consultar saldo de créditos | jwt |
| `livekit-room` | Gerar token LiveKit | no |
| `login-with-credential` | Login com nickname/email | no |
| `monitor-lives` | Cron de monitoramento de lives | no |
| `password-reset` | Reset de senha customizado | no |
| `pix-withdraw` | Solicitar saque PIX | jwt |
| `process-pix-payout` | Admin: processar payout | jwt |
| `reconcile-transfers` | Reconciliar transferências | admin |
| `registration-checkout` | Checkout de cadastro | no |
| `velana-webhook` | Receber webhooks Velana | no |
| `viewer-heartbeat` | Heartbeat de viewer | no |

---

## 7. Banco de Dados

### Tabelas Principais

| Tabela | Descrição |
|--------|-----------|
| `profiles` | Perfis de usuário (username, referral_code, affiliate_earnings) |
| `creator_profiles` | Perfis públicos de criadores (display_name, approved_for_live) |
| `credits_wallet` | Carteira de créditos do viewer |
| `creator_wallet` | Carteira do criador (balance_cents, pending_cents) |
| `lives` | Lives criadas (status, webrtc_room_name) |
| `live_consumption` | Consumo de créditos por sessão |
| `live_access` | Acessos concedidos a lives |
| `creator_earnings` | Ganhos do criador por live |
| `payout_requests` | Solicitações de saque |
| `transactions` | Histórico geral de transações |
| `registration_referrals` | Cadastros pendentes com referral |
| `affiliate_logs` | Log de comissões distribuídas |
| `platform_revenue` | Receita da plataforma |
| `user_roles` | Roles (admin/creator/viewer) |
| `superchats` | SuperChats enviados |
| `messages` | Mensagens de chat |
| `rooms` | Salas de chat |
| `payment_intents` | Intenções de pagamento Velana |
| `wallet_transactions` | Ledger de transações de wallet |

### Funções RPC

| Função | Descrição |
|--------|-----------|
| `has_role(user_id, role)` | Verifica se usuário tem role |
| `increment_balance(user_id, amount)` | Incrementa saldo profile |
| `increment_affiliate_earnings(profile_id, cents)` | Incrementa ganhos afiliado |
| `increment_creator_wallet(creator_id, cents)` | Incrementa carteira criador |
| `get_or_create_creator_wallet(creator_id)` | Obtém/cria carteira |
| `validate_referral_code(code)` | Valida código de referral |

### RLS (Row Level Security)

Todas as tabelas têm RLS habilitado. Principais políticas:
- Usuários só veem seus próprios dados
- Admins veem tudo
- Service role bypassa RLS

---

## 8. Fluxos Críticos

### 8.1 Fluxo de Pagamento PIX (Cash-In)

```
1. Frontend chama create-velana-payment
2. Edge Function cria payment_intent no banco
3. Retorna QR Code PIX
4. Usuário paga
5. Velana envia webhook para velana-webhook
6. Edge Function valida, atualiza payment_intent
7. Processa conforme purchase_type:
   - credits: adiciona créditos
   - registration: cria conta
   - superchat: insere superchat
```

### 8.2 Fluxo de Saque PIX (Cash-Out)

```
1. Criador solicita saque via pix-withdraw
2. Valida saldo e chave PIX
3. Debita balance_cents, adiciona pending_cents
4. Chama Velana API POST /v1/transfers
5. Velana processa transferência
6. (opcional) Webhook confirma ou falha
7. Atualiza payout_requests status
```

### 8.3 Fluxo de Cadastro

```
1. Usuário acessa /subscribe?ref=CODE
2. Valida código de afiliado
3. Preenche formulário (nome, email, senha, nickname)
4. registration-checkout cria registration_referrals (pending)
5. create-velana-payment gera PIX
6. Usuário paga
7. velana-webhook:
   - Cria usuário Supabase Auth
   - Distribui comissões (R$1 pai, R$0.50 avô)
   - Atualiza status para completed
8. Usuário faz login
```

### 8.4 Fluxo de Afiliados

```
1. Usuário gera link: /subscribe?ref={referral_code}
2. Novo usuário clica no link
3. registration_referrals guarda referrer_id e referrer_parent_id
4. Após pagamento:
   - affiliate_logs registra comissão
   - profiles.affiliate_earnings incrementa
   - Pai recebe R$1.00, Avô recebe R$0.50
```

### 8.5 Fluxo de Live (Streaming)

```
1. Criador clica "Ficar Online"
2. Frontend cria live no banco (status: live)
3. livekit-room gera token de host
4. WebRTCPublisher conecta no LiveKit
5. Viewer acessa página da live
6. 20s preview (paywall)
7. Se tem créditos: viewer-heartbeat inicia
8. A cada 10s: debita créditos
9. Criador encerra: settlement calcula ganhos
10. 80% para creator_wallet, 20% para plataforma
```

---

## 9. Credenciais e Acessos

### Serviços que o Novo Dev Precisa Acesso

| Serviço | O que precisa | Onde configurar |
|---------|---------------|-----------------|
| **Lovable** | Acesso ao projeto | Convite como colaborador |
| **Supabase** | Dashboard do projeto | Via Lovable Cloud |
| **LiveKit** | Dashboard e API keys | https://cloud.livekit.io |
| **Velana** | Dashboard e API keys | Portal Velana |
| **Resend** | API key para emails | https://resend.com |
| **GitHub** | Repositório | Convite como colaborador |

### Contas Admin Existentes

- `pgxbrasil@gmail.com` (admin principal)
- Outros conforme tabela `user_roles`

---

## 10. Problemas Conhecidos e Soluções

### 10.1 Secret da Velana Truncado

**Problema:** Variáveis de ambiente longas são truncadas no Supabase.

**Solução:** Hardcode do secret como fallback nas Edge Functions:
```typescript
const transferSecret = Deno.env.get("VELANA_TRANSFER_SECRET") || "CHAVE_COMPLETA_AQUI";
```

### 10.2 Login com Nickname Falhava

**Problema:** Tentava resolver nickname no frontend, falhava.

**Solução:** Edge Function `login-with-credential` resolve server-side:
1. Busca email por nickname na tabela `profiles`
2. Faz `signInWithPassword` com email
3. Retorna tokens

### 10.3 Password Reset para Domínio Errado

**Problema:** Links de reset iam para preview domain.

**Solução:** `getSiteUrl()` força domínio de produção:
```typescript
export function getSiteUrl() {
  return "https://streamstar.lovable.app";
}
```

### 10.4 Velana Cash-In Payload

**Problema:** Estrutura do payload Velana varia.

**Solução:** Checar múltiplos caminhos:
```typescript
const qrCode = data?.pix?.qrcode || data?.payload?.data?.pix?.qrcode;
```

### 10.5 Contas Admin sem Registro em registration_referrals

**Problema:** Admins criados via `admin-create-user` não tinham registro, login por nickname falhava.

**Solução:** 
1. Fallback query na tabela `profiles` diretamente
2. Ou: inserir registro manualmente na tabela

---

## 11. Documentação Relacionada

| Documento | Descrição | Path |
|-----------|-----------|------|
| **ONBOARDING_DEVELOPER.md** | Guia completo para novos devs | `docs/ONBOARDING_DEVELOPER.md` |
| **FINANCIAL_API_DOCUMENTATION.md** | APIs financeiras detalhadas | `docs/FINANCIAL_API_DOCUMENTATION.md` |
| **SYSTEM_ARCHITECTURE_QA.md** | Mapeamento de tabelas e rotas | `docs/SYSTEM_ARCHITECTURE_QA.md` |
| **RELATORIO_SAQUES_WALLET.md** | Sistema de saques e wallets | `docs/RELATORIO_SAQUES_WALLET.md` |
| **database-schema-export.sql** | Dump do schema SQL | `docs/database-schema-export.sql` |
| **ARCHITECTURE.md** | Visão geral de arquitetura | `ARCHITECTURE.md` |
| **README_TECHNICAL.md** | Setup e fluxos críticos | `README_TECHNICAL.md` |

---

## Checklist de Handoff

- [ ] Novo dev tem acesso ao repositório
- [ ] Novo dev tem acesso ao Lovable
- [ ] Credenciais de serviços externos compartilhadas de forma segura
- [ ] Ambiente local funcionando
- [ ] Leu toda a documentação em `/docs`
- [ ] Entende os fluxos de pagamento PIX
- [ ] Entende o sistema de afiliados
- [ ] Entende o streaming LiveKit

---

*Documento gerado em 2025-01-30. Manter atualizado conforme evolução do projeto.*
