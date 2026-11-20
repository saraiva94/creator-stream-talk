# Creator Stream Talk

Plataforma de live streaming com monetizacao integrada para a creator economy.

## Sobre

Creator Stream Talk e uma aplicacao full-stack que permite creators transmitirem ao vivo com audio e video via WebRTC, receberem pagamentos em tempo real (creditos e superchats) e gerenciarem seus ganhos com saques via PIX. A plataforma inclui chat ao vivo com indicadores de presenca, sistema de afiliados com comissoes, painel administrativo e suporte a instalacao como PWA em dispositivos moveis.

O projeto resolve o problema de creators que dependem de multiplas ferramentas desconectadas para transmitir, monetizar e receber. Aqui, transmissao, pagamento, chat e gestao financeira estao em um unico produto, com processamento automatico de saques e dashboards de receita para creators e administradores.

## Stack

| Camada | Tecnologia | Proposito |
|--------|-----------|-----------|
| Frontend | React 18 + TypeScript | SPA com tipagem estatica |
| Build | Vite 5 | Dev server com HMR e bundling otimizado |
| Estilizacao | Tailwind CSS + shadcn/ui (Radix) | Sistema de design com componentes acessiveis |
| Estado servidor | TanStack React Query | Cache, refetch e sincronizacao de dados assincronos |
| Roteamento | React Router v6 | Rotas protegidas por papel (viewer, creator, admin) |
| Backend | Node.js + Express 5 + TypeScript | API REST com rate limiting e validacao |
| Banco de dados | Supabase (PostgreSQL) | Auth, storage, realtime subscriptions e edge functions |
| Streaming | LiveKit (WebRTC) | Transmissao de audio/video com baixa latencia |
| Pagamentos | Mercado Pago Checkout Pro | Cadastro, créditos e SuperChats com recebimento em uma conta |
| Email | Resend | Emails transacionais |
| Logging (backend) | Pino | Logs estruturados em JSON |
| Logging (frontend) | Logger customizado | Logs por modulo com historico em memoria |
| Validacao | Zod | Schemas de validacao em runtime |
| Testes | Vitest + Testing Library | Testes unitarios e de componente |

## Funcionalidades

- Transmissao ao vivo com video/audio via WebRTC (LiveKit), com suporte a camera frontal/traseira e troca dinamica
- Chat em tempo real por live com typing indicators via Supabase Presence
- Chat global com mensagens de texto, audio, reacoes e mensagens diretas
- Sistema de creditos: compra via Mercado Pago, consumo em superchats e preview de lives
- Superchats com tiers visuais, progress bar animado e fila de exibicao
- Histórico de saques e acompanhamento dos saldos de criadores e afiliados
- Painel do creator: dashboard de receita, historico de lives, gerenciamento de tags e configuracoes
- Painel administrativo: gestao de creators, aprovacao/rejeicao de saques e logs de webhooks
- Sistema de afiliados com codigo de referral, comissoes e dashboard dedicado
- Perfil publico de creator com link compartilhavel (`/u/:username`)
- Preview de live com timer configuravel e expiracao automatica
- Captura automatica de thumbnails durante transmissao
- Logout por inatividade apos 24h sem interacao
- PWA instalavel em iOS e Android com prompt adaptado por plataforma
- Layout responsivo com deteccao de dispositivo via matchMedia

## Arquitetura

O frontend usa Context API para estado global (auth, creditos, sidebar, tema) e React Query para cache de dados do servidor com `keepPreviousData` para transicoes sem flickering. A comunicacao com o backend passa por um API client centralizado com envelope pattern (`{ success, data, error }`), cache de access token com TTL de 30 segundos e redirect automatico em 401/403. Operacoes de rede criticas usam retry com backoff customizavel e suporte a AbortSignal. O real-time e feito em duas camadas: Supabase Realtime (postgres changes para chat e notificacoes) e LiveKit (WebRTC para streaming de midia). O sistema de logging do frontend organiza logs por modulo (AUTH, PAYMENT, LIVE, API) com cores no console e historico exportavel, enquanto o backend usa Pino para logs estruturados. Pagamentos passam por edge functions do Supabase para processamento de PIX e webhooks do Mercado Pago, com o backend Node servindo como API REST para operacoes CRUD, autorizacao por roles e rate limiting.

## E-mails de autenticação

O cadastro exige a confirmação do endereço de e-mail. Para enviar pelo Resend, publique `supabase/functions/auth-email-hook` no projeto de produção e habilite **Send Email Hook** no Supabase Auth. Use a URL HTTPS da Edge Function e o mesmo segredo gerado pelo Supabase nos dois lados. [Configuração do Send Email Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook)

Configure estes valores em **Edge Functions → Secrets**:

- `RESEND_API_KEY` com a chave do Resend autorizada a enviar.
- `RESEND_FROM_EMAIL` com o remetente de um domínio verificado no Resend.
- `SEND_EMAIL_HOOK_SECRET` com o segredo do Send Email Hook.
- `SITE_URL` com o domínio público do site, caso seja diferente de `https://streamstar.vercel.app`.

Em **Supabase Auth → URL Configuration**, configure o **Site URL** e permita os retornos `/subscribe?flow=signup` e `/update-password` do domínio do StreamStar. O usuário pode reenviar a confirmação após o cadastro ou no login quando a conta ainda está sem confirmação.

## Recebimentos pelo Mercado Pago

O Checkout Pro recebe na conta associada ao token da aplicação. Ao aprovar o pagamento, o Mercado Pago envia um webhook. O StreamStar confere o pedido, registra o recebimento e envia um aviso no sino de notificações dos administradores. Em **Admin → Ferramentas Financeiras**, é possível consultar e reprocessar um pagamento aprovado pelo ID.

1. Aplique a migração `20261119193000_restore_mercadopago.sql` no projeto Supabase.
2. Em **Edge Functions → Secrets**, configure `MERCADOPAGO_ACCESS_TOKEN` e `MERCADOPAGO_WEBHOOK_SECRET` com os valores da aplicação da conta recebedora. Para outro domínio, configure `SITE_URL` com a URL pública do StreamStar.
3. Na aplicação do Mercado Pago, ative o evento **Pagamentos** com o endpoint `https://<project-ref>.supabase.co/functions/v1/mercadopago-webhook`. [Documentação de Webhooks do Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/payment-notifications)
4. Em **Supabase Auth → URL Configuration**, permita o retorno de confirmação de e-mail para `https://<domínio-do-streamstar>/subscribe?flow=signup`.
5. Publique as funções `create-payment`, `create-superchat-payment`, `registration-checkout`, `mercadopago-webhook` e `process-pending-payment`, e publique o frontend.

## Como rodar localmente

**Pre-requisitos:**
- Node.js >= 18
- npm
- Conta no Supabase com projeto configurado (auth, storage, edge functions)
- Credenciais LiveKit (para streaming)
- Credenciais Mercado Pago (para pagamentos)

**Frontend:**

```bash
# Instalar dependencias
npm install

# Copiar variaveis de ambiente
cp .env.example .env
# Preencher as variaveis no .env

# Iniciar dev server (porta 8080)
npm run dev
```

**Backend:**

```bash
# Instalar dependencias do backend
cd backend
npm install

# Iniciar backend em modo dev (porta 4000)
npm run dev
```

**Scripts disponiveis:**

| Comando | Descricao |
|---------|-----------|
| `npm run dev` | Inicia o frontend com Vite |
| `npm run build` | Build de producao do frontend |
| `npm run lint` | Executa ESLint no frontend |
| `npm run test` | Executa testes com Vitest |
| `npm run backend:dev` | Inicia o backend em modo dev |
| `npm run backend:build` | Build de producao do backend |

## Variaveis de ambiente

| Variavel | Descricao |
|----------|-----------|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave publica (anon) do Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave anon do Supabase (alias) |
| `VITE_SUPABASE_PROJECT_ID` | ID do projeto Supabase |
| `VITE_SITE_URL` | URL publica do frontend |
| `VITE_API_URL` | URL publica do backend Node |
| `VITE_USE_LIVEKIT` | Habilita integracao LiveKit (`true`/`false`) |
| `SUPABASE_URL` | URL do Supabase para o backend |
| `SUPABASE_ANON_KEY` | Chave anon do Supabase para o backend |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service role do Supabase (acesso administrativo) |
| `SUPABASE_JWT_SECRET` | Secret JWT para validacao de tokens |
| `BACKEND_PORT` | Porta do servidor backend |
| `LOG_LEVEL` | Nivel de log do backend (`info`, `debug`, `warn`, `error`) |
| `PUBLIC_BASE_URL` | URL publica do backend para webhooks |
| `ALLOWED_ORIGINS` | Origens permitidas pelo CORS |
| `ALLOWED_WEBHOOK_DOMAIN` | Dominio autorizado para receber webhooks |
| `HEARTBEAT_INTERVAL_MS` | Intervalo de heartbeat para lives ativas |
| `HEARTBEAT_TOLERANCE_MS` | Tolerancia antes de considerar live inativa |
| `MERCADOPAGO_ACCESS_TOKEN` | Token de acesso do Mercado Pago |
| `MERCADOPAGO_PUBLIC_KEY` | Chave publica do Mercado Pago |
| `MERCADOPAGO_WEBHOOK_SECRET` | Secret para validacao de webhooks |
| `MERCADOPAGO_WEBHOOK_URL` | URL de callback para webhooks |
| `MERCADOPAGO_CURRENCY` | Moeda para transacoes (`BRL`, `USD`) |
