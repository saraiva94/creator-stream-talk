# Stream Live Hub - Documentação de Arquitetura para QA

## 📊 MAPEAMENTO COMPLETO DE TABELAS

### Tabelas Principais

| Tabela | Descrição | Colunas Chave |
|--------|-----------|---------------|
| `profiles` | Perfis de usuários | id, username, email, referral_code, affiliate_earnings, status, referrer_direct, referrer_root |
| `creator_profiles` | Perfis de criadores | id, display_name, bio, approved_for_live, is_streaming |
| `credits_wallet` | Carteira de créditos do viewer | id, user_id, profile_id, balance_credits |
| `creator_wallet` | Carteira do criador (em centavos) | creator_id, balance_cents, pending_cents, total_earned_cents |
| `lives` | Lives criadas | id, creator_id, title, status, room_name, webrtc_room_name, price, is_active |
| `live_access` | Acesso concedido a lives | live_id, user_id, status, granted_at |
| `live_consumption` | Consumo de créditos em lives | live_id, user_id, seconds_watched, credits_consumed, session_token |
| `creator_earnings` | Ganhos dos criadores por live | live_id, creator_id, credits_consumed, creator_amount_cents, platform_amount_cents |

### Tabelas de Afiliados

| Tabela | Descrição | Colunas Chave |
|--------|-----------|---------------|
| `referrals` | Indicações legadas | referrer_id, referred_id, referral_code, commission_earned |
| `registration_referrals` | Indicações de registro | payment_id, user_id, email, referrer_id, referrer_parent_id, is_root_creator |
| `affiliate_logs` | Histórico de comissões | new_user, direct_referrer, root_creator, amount_direct, amount_root, event_type |

### Tabelas de Pagamento

| Tabela | Descrição | Colunas Chave |
|--------|-----------|---------------|
| `payments` | Pagamentos registrados | user_id, live_id, amount, status, external_id |
| `credit_purchases` | Compras de créditos | profile_id, credits, amount_cents, payment_id, status |
| `transactions` | Transações gerais | user_id, creator_id, affiliate_id, amount, type, status |
| `webhook_events` | Idempotência de webhooks | idempotency_key |

### Tabelas de Admin

| Tabela | Descrição | Colunas Chave |
|--------|-----------|---------------|
| `user_roles` | Roles de usuários (admin/creator/viewer) | user_id, role |
| `payout_requests` | Solicitações de saque | creator_id, amount, status, bank_account_id |
| `creator_bank_accounts` | Contas bancárias | creator_id, bank_name, account_number, document_number |

---

## 🔄 FLUXO DE DADOS ENTRE TABELAS

### Fluxo de Registro com Afiliado
```
1. Usuario acessa /subscribe?ref={code}
2. profiles → busca referral_code
3. registration_referrals → cria registro pendente
4. Mercado Pago → processa pagamento
5. webhook → finalizeRegistrationReferral()
6. profiles → atualiza referrer_direct, referrer_root
7. affiliate_logs → registra comissão
8. profiles.affiliate_earnings → incrementa via RPC
```

### Fluxo de Compra de Créditos
```
1. POST /payments/create-preference (purchaseType='credits')
2. Mercado Pago → cria preferência
3. Usuario paga
4. Webhook → event_type='CREDITS_PURCHASE'
5. credit_purchases → registra compra
6. credits_wallet → atualiza balance_credits
```

### Fluxo de Consumo em Live
```
1. POST /lives/access → cria live_access
2. Heartbeat a cada 10s → POST /lives/{id}/heartbeat
3. live_consumption → atualiza seconds_watched, credits_consumed
4. credits_wallet → debita créditos (6/min = 0.1/segundo)
5. Ao encerrar live:
   - creator_earnings → registra ganhos
   - creator_wallet → credita 80% do valor
```

---

## 🛤️ ROTAS DO BACKEND

### Status & Health
| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/status` | Não | Health check |

### Autenticação
| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/auth/login` | Não | Login |
| POST | `/auth/signup` | Não | Cadastro |
| POST | `/auth/logout` | Sim | Logout |

### Registro
| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/registration/checkout` | Não | Checkout de registro |

### Pagamentos
| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/payments/create-preference` | Sim | Criar preferência MP |
| POST | `/payments/create-registration-preference` | Não | Preferência de registro |
| POST | `/payments/webhook` | Não | Webhook Mercado Pago |

### Créditos
| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/credits/balance` | Sim | Saldo de créditos |
| POST | `/credits/purchase` | Sim | Comprar créditos |

### Lives
| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/lives/public` | Não | Lista lives públicas |
| GET | `/lives/creator` | Criador | Lista lives do criador |
| POST | `/lives/start` | Criador | Iniciar live |
| GET | `/lives/:liveId/info` | Sim | Info da live |
| POST | `/lives/access` | Sim | Solicitar acesso |
| POST | `/lives/:liveId/heartbeat` | Sim | Heartbeat (consumo) |

### Afiliados
| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/affiliate/link` | Sim | Obter link de afiliado |
| GET | `/affiliate/overview` | Sim | Estatísticas |
| GET | `/affiliate/history` | Sim | Histórico de comissões |

### Criadores
| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/creators/balance` | Criador | Saldo da carteira |
| POST | `/creators/withdraw` | Criador | Solicitar saque |
| GET | `/creators/payouts` | Criador | Histórico de saques |

### Admin
| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/admin/creators` | Admin | Lista criadores pendentes |
| POST | `/admin/creators/:id/approve` | Admin | Aprovar criador |
| GET | `/admin/payouts` | Admin | Lista saques |
| POST | `/admin/payouts/:id/approve` | Admin | Aprovar saque |
| POST | `/admin/payouts/:id/reject` | Admin | Rejeitar saque |

---

## 📦 SERVICES DO BACKEND

| Service | Responsabilidade |
|---------|-----------------|
| `affiliateService.ts` | Resolução de referral, cálculo de comissões |
| `creditsWalletService.ts` | Gestão de carteira de créditos |
| `mercadoPagoService.ts` | Integração Mercado Pago |
| `creatorEarningsService.ts` | Settlement de ganhos do criador |
| `creatorWithdrawalsService.ts` | Gestão de saques |
| `liveConsumptionService.ts` | Consumo de créditos em lives |

---

## 🔐 VARIÁVEIS DE AMBIENTE

### Obrigatórias
```
VITE_SUPABASE_URL          # URL do Supabase
VITE_SUPABASE_PUBLISHABLE_KEY  # Anon key
VITE_USE_LIVEKIT=true      # Ativa LiveKit WebRTC
MERCADOPAGO_ACCESS_TOKEN   # Token de acesso MP
MERCADOPAGO_PUBLIC_KEY     # Chave pública MP
MERCADOPAGO_WEBHOOK_SECRET # Secret do webhook
```

### LiveKit (Supabase Secrets)
```
LIVEKIT_URL                # URL do LiveKit Cloud
LIVEKIT_API_KEY            # API Key LiveKit
LIVEKIT_API_SECRET         # API Secret LiveKit
```

---

## 🔗 INTEGRAÇÕES EXTERNAS

### 1. Supabase
- **Auth**: Autenticação JWT + envio de emails nativos (reset de senha, confirmação)
- **Database**: PostgreSQL
- **RPC**: Funções customizadas
- **Realtime**: Subscriptions (chat, lives)

### 2. Mercado Pago
- **Checkout Pro**: Preferências de pagamento
- **Webhooks**: Notificação de pagamentos aprovados
- **Tipos**: REGISTRATION, CREDITS_PURCHASE, LIVE_ACCESS

### 3. LiveKit (WebRTC)
- **Video Streaming**: WebRTC via LiveKit Cloud
- **Edge Function**: `livekit-room` gera tokens JWT
- **Salas**: Criadas automaticamente ao host conectar
- **Secrets**: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET

---

## 📐 FUNÇÕES RPC DISPONÍVEIS

| Função | Parâmetros | Descrição |
|--------|------------|-----------|
| `has_role` | user_id, role | Verifica se user tem role |
| `increment_balance` | user_id, amount | Incrementa saldo profile |
| `increment_affiliate_earnings` | profile_id, amount_cents | Incrementa ganhos afiliado |
| `increment_creator_wallet` | creator_id, amount_cents | Incrementa carteira criador |
| `get_or_create_creator_wallet` | creator_id | Obtém/cria carteira |
| `is_subscribed_to_creator` | user_id, creator_id | Verifica assinatura |

---

## 🧮 FÓRMULAS DE NEGÓCIO

### Conversão Créditos ↔ Valor
```
180 créditos = R$ 5,00 (500 centavos)
1 crédito = R$ 0,0278
Consumo: 6 créditos/minuto = 0.1 créditos/segundo
```

### Distribuição de Receita (Live)
```
Total = créditos_consumidos × (500/180) centavos
Criador = Total × 80%
Plataforma = Total × 20%
```

### Comissões de Registro (R$ 5,00)
```
Pai (direct) = R$ 1,00 (100 centavos)
Avô (root) = R$ 0,50 (50 centavos) - se diferente do pai
Plataforma = Restante (R$ 3,50 ou R$ 4,00)
```

---

## ✅ CHECKLIST DE QA

### Autenticação
- [ ] Login com email/senha funciona
- [ ] Signup cria profile
- [ ] Reset de senha envia email via Supabase Auth
- [ ] JWT persiste entre sessões

### Registro com Afiliado
- [ ] Link /subscribe?ref={code} funciona
- [ ] Valida código de afiliado
- [ ] Cria preferência MP
- [ ] Webhook processa pagamento
- [ ] Comissões distribuídas corretamente

### Créditos
- [ ] Balance retorna saldo correto
- [ ] Compra cria preferência MP
- [ ] Webhook credita créditos
- [ ] Histórico de compras registrado

### Lives (LiveKit WebRTC)
- [ ] Lista pública funciona sem auth
- [ ] Criador pode iniciar live (solicita câmera/mic)
- [ ] Viewer pode assistir após paywall
- [ ] Heartbeat debita créditos
- [ ] Encerramento calcula settlement

### Afiliados
- [ ] Gera link único
- [ ] Overview mostra estatísticas
- [ ] Histórico lista transações

### Admin
- [ ] Lista criadores pendentes
- [ ] Aprovação funciona
- [ ] Lista saques pendentes
- [ ] Aprovação/rejeição funciona
