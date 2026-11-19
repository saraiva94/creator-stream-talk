# Stream Star

Plataforma de streaming ao vivo com monetização via créditos e sistema de afiliados.

## 🚀 Quick Start

```bash
# Instalar dependências
npm install

# Copiar variáveis de ambiente
cp .env.example .env

# Rodar em desenvolvimento
npm run dev
```

## 📚 Documentação

A documentação técnica completa está em **[docs/DOCUMENTACAO_COMPLETA.md](docs/DOCUMENTACAO_COMPLETA.md)**.

## 🛠️ Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend:** Supabase Edge Functions (Deno)
- **Streaming:** LiveKit (WebRTC)
- **Pagamentos:** Mercado Pago Checkout Pro para recebimentos. Saques automáticos indisponíveis.
- **Hospedagem:** Lovable Cloud

## 🔗 Links

- **Produção:** https://streamstar.lovable.app
- **Lovable Project:** https://lovable.dev/projects/3f92ff11-c725-4c41-b7e6-aaef0cf5370c

## 📁 Estrutura

```
src/           → Frontend React
supabase/      → Edge Functions (backend)
backend/       → Backend Node auxiliar
docs/          → Documentação
```

## 📖 Editar o Código

### Via Lovable
Acesse o [Lovable Project](https://lovable.dev/projects/3f92ff11-c725-4c41-b7e6-aaef0cf5370c) e use prompts para fazer alterações.

### Localmente
```bash
git clone <URL_DO_REPOSITORIO>
cd stream-star
npm install
npm run dev
```

## 🚢 Deploy

Push para o repositório → deploy automático via Lovable Cloud.

Para publicar manualmente: Lovable → Share → Publish.
