# Stream Star - Manual do Gestor

> O checkout de cadastro, créditos e SuperChats usa [Mercado Pago](../README.md#recebimentos-pelo-mercado-pago). As descrições abaixo sobre a Velana registram o fluxo anterior. Saques automáticos estão indisponíveis.

**Versão:** 1.1  
**Data:** 2025-01-30  
**Para:** Gestores e Administradores (não-técnicos)

---

## Índice

1. [Introdução](#1-introdução)
2. [Acessando o Painel Admin](#2-acessando-o-painel-admin)
3. [Gerenciando Criadores](#3-gerenciando-criadores)
4. [Gerenciando Saques](#4-gerenciando-saques)
5. [Acompanhando Receitas](#5-acompanhando-receitas)
6. [Gerenciando Usuários](#6-gerenciando-usuários)
7. [Sistema de Afiliados](#7-sistema-de-afiliados)
8. [Entendendo os Fluxos de Dinheiro](#8-entendendo-os-fluxos-de-dinheiro)
9. [Tabelas de Referência Rápida](#9-tabelas-de-referência-rápida)
10. [Perguntas Frequentes](#10-perguntas-frequentes)

---

## 1. Introdução

### O que é o Stream Star?

O Stream Star é uma plataforma de streaming ao vivo onde:

- **Criadores** fazem transmissões ao vivo e ganham dinheiro
- **Viewers (espectadores)** compram créditos e assistem lives
- **Afiliados** ganham comissões indicando novos usuários
- **Você (Gestor)** administra tudo pelo painel admin

### Papéis no Sistema

| Papel | O que faz |
|-------|-----------|
| **Viewer** | Compra créditos, assiste lives, envia SuperChats |
| **Criador** | Faz lives, recebe 80% dos créditos consumidos |
| **Afiliado** | Indica novos usuários, ganha comissões |
| **Admin** | Aprova criadores, monitora receita, gerencia plataforma |

---

## 2. Acessando o Painel Admin

### Como acessar

1. Acesse o site da plataforma
2. Faça login com sua conta de administrador
3. No menu, clique em **"Admin"** ou acesse `/admin`

### Áreas do Painel Admin

| Área | O que faz | Rota |
|------|-----------|------|
| **Dashboard** | Visão geral de métricas | `/admin` |
| **Criadores** | Aprovar/revogar permissão de live | `/admin/creators` |
| **Saques PIX** | Visualizar histórico de saques | `/admin/pix-withdrawals` |
| **Receita** | Acompanhar receita da plataforma | `/platform-revenue` |

---

## 3. Gerenciando Criadores

### O que são criadores?

Criadores são usuários que podem fazer transmissões ao vivo. Antes de transmitir, eles precisam de **aprovação do admin**.

### Como aprovar um criador

1. Acesse `/admin/creators`
2. Veja a lista de criadores pendentes
3. Clique em **"Aprovar"** para liberar ou **"Revogar"** para bloquear

### Status dos criadores

| Status | Significado |
|--------|-------------|
| **Pendente** | Aguardando aprovação para fazer lives |
| **Aprovado** | Pode fazer lives normalmente |
| **Revogado** | Teve permissão removida |

---

## 4. Gerenciando Saques

### Como funciona o saque?

Os saques são **100% automatizados** via PIX (Velana):

1. Criador acumula saldo (80% dos créditos consumidos em suas lives)
2. Criador solicita saque via PIX informando a chave PIX
3. O sistema valida a chave PIX e processa automaticamente
4. O dinheiro é enviado instantaneamente via PIX

> ⚠️ **Nota:** Não há aprovação manual de saques. O processo é totalmente automatizado.

### Regras de Saque

| Regra | Valor |
|-------|-------|
| **Saldo mínimo para solicitar** | R$ 15,00 |
| **Valor mínimo por saque** | R$ 5,00 (após descontar taxa) |
| **Taxa fixa por saque** | R$ 5,00 |

### Exemplo de Saque

```
Criador tem R$ 20,00 de saldo
Solicita saque de R$ 15,00

Resultado:
- Taxa descontada: R$ 5,00
- Valor enviado via PIX: R$ 10,00
- Saldo restante: R$ 5,00
```

### Status dos saques

| Status | Significado |
|--------|-------------|
| **Pendente** | Processando |
| **Pago** | PIX enviado com sucesso |
| **Falhou** | Erro no processamento (chave inválida, etc.) |

---

## 5. Acompanhando Receitas

### De onde vem o dinheiro?

| Fonte | Descrição | % Plataforma | Valor para Plataforma |
|-------|-----------|--------------|----------------------|
| **Cadastros** | Usuários pagam R$ 7,00 para se cadastrar | ~78,5% | R$ 5,50 |
| **Lives** | Viewers consomem créditos assistindo | 20% | 20% do consumo |
| **SuperChats** | Mensagens destacadas pagas | 20% | 20% do valor |

### Como ver a receita

1. Acesse `/platform-revenue`
2. Veja os cards com métricas:
   - Receita total
   - Receita de cadastros
   - Receita de lives
   - Receita de SuperChats

---

## 6. Gerenciando Usuários

### Tipos de usuário

| Tipo | Permissões |
|------|------------|
| **Usuário comum** | Comprar créditos, assistir lives |
| **Criador aprovado** | Tudo acima + fazer lives |
| **Admin** | Tudo acima + painel administrativo |

### Como tornar alguém admin

Isso requer acesso ao banco de dados. Peça ao desenvolvedor para inserir na tabela `user_roles`.

---

## 7. Sistema de Afiliados

### Como funciona?

1. Todo usuário tem um **código de indicação** único
2. Ele compartilha o link: `streamstar.vercel.app/subscribe?ref=CODIGO`
3. Quando alguém se cadastra pelo link e paga R$ 7,00:

| Destino | Valor |
|---------|-------|
| **Afiliado direto** (quem indicou) | R$ 1,00 |
| **Afiliado raiz** (quem indicou quem indicou) | R$ 0,50 |
| **Plataforma** | R$ 5,50 |

### Exemplo prático

```
João indica Maria (link com código do João)
Pedro havia indicado João anteriormente

Maria se cadastra e paga R$ 7,00

Resultado:
- João (afiliado direto): +R$ 1,00
- Pedro (afiliado raiz/avô): +R$ 0,50
- Plataforma: +R$ 5,50
```

### Onde ver comissões de afiliados?

Os afiliados veem seus ganhos em **Perfil → Afiliados** (`/affiliate`).

---

## 8. Entendendo os Fluxos de Dinheiro

### Fluxo de Cadastro (R$ 7,00)

```
Usuário paga R$ 7,00 via PIX
        ↓
   Velana processa
        ↓
┌───────────────────────────────┐
│ R$ 1,00 → Afiliado direto     │
│ R$ 0,50 → Afiliado raiz       │
│ R$ 5,50 → Plataforma          │
└───────────────────────────────┘
```

### Fluxo de Consumo de Lives

```
Viewer assiste live (6 créditos/minuto)
        ↓
   Créditos descontados
        ↓
┌───────────────────────────────┐
│ 80% → Saldo do Criador        │
│ 20% → Plataforma              │
└───────────────────────────────┘
```

### Fluxo de SuperChat

```
Viewer envia SuperChat (R$ 3, 5 ou 8)
        ↓
   Velana processa PIX
        ↓
┌───────────────────────────────┐
│ 80% → Saldo do Criador        │
│ 20% → Plataforma              │
└───────────────────────────────┘
```

---

## 9. Tabelas de Referência Rápida

### Pacotes de Créditos

| Pacote | Créditos | Preço (R$) | Equivale a |
|--------|----------|------------|------------|
| Básico | 180 | R$ 5,00 | 30 minutos |
| Padrão | 360 | R$ 9,00 | 60 minutos (1 hora) |

> **Fórmula:** 180 créditos = R$ 5,00 = 30 minutos de live

### Consumo de Créditos

| Métrica | Valor |
|---------|-------|
| Créditos por minuto | 6 créditos |
| Créditos por segundo | 0,1 créditos |
| Heartbeat (intervalo de cobrança) | 10 segundos |

### SuperChats (Tiers)

| Tier | Cor | Valor (R$) | Duração em Destaque |
|------|-----|------------|---------------------|
| Blue | 🔵 Azul | R$ 3,00 | 1 minuto |
| Yellow | 🟡 Amarelo | R$ 5,00 | 2 minutos |
| Red | 🔴 Vermelho | R$ 8,00 | 3 minutos |

> **Split:** 80% para o criador, 20% para a plataforma

### Cadastro e Comissões

| Item | Valor |
|------|-------|
| Valor do cadastro | R$ 7,00 |
| Comissão afiliado direto | R$ 1,00 |
| Comissão afiliado raiz (avô) | R$ 0,50 |
| Receita da plataforma | R$ 5,50 |

### Saques

| Regra | Valor |
|-------|-------|
| Saldo mínimo para solicitar | R$ 15,00 |
| Valor mínimo por saque | R$ 5,00 |
| Taxa fixa por saque | R$ 5,00 |

### Split de Lives

| Destinatário | Percentual |
|--------------|------------|
| Criador | 80% |
| Plataforma | 20% |

---

## 10. Perguntas Frequentes

### "Um criador quer fazer live mas não consegue"

→ Verifique se ele está **aprovado** em `/admin/creators`

### "Um saque não foi processado"

→ Verifique se:
- O criador tem saldo mínimo de R$ 15,00
- A chave PIX informada é válida
- O status em `/admin/pix-withdrawals`

### "Quanto a plataforma ganha?"

→ 20% das lives e SuperChats + R$ 5,50 por cadastro

### "Os saques precisam de aprovação?"

→ **Não.** Os saques são 100% automatizados. O sistema valida a chave PIX e processa instantaneamente.

### "Posso alterar os valores (comissões, splits)?"

→ Sim, mas precisa de um desenvolvedor para alterar no código

### "Como adiciono um novo admin?"

→ Precisa de acesso ao banco de dados. O desenvolvedor deve inserir na tabela `user_roles` com role = 'admin'

### "Qual a conversão de créditos para minutos?"

→ 180 créditos = 30 minutos (6 créditos por minuto)

### "Qual a conversão de créditos para reais?"

→ 180 créditos = R$ 5,00

---

## Contatos de Suporte Técnico

| Assunto | Contato |
|---------|---------|
| **Problemas com PIX/Pagamentos** | Suporte Velana |
| **Problemas com streaming** | Suporte LiveKit |
| **Problemas no sistema** | Equipe de desenvolvimento |

---

*Manual do Gestor - Stream Star v1.1*
