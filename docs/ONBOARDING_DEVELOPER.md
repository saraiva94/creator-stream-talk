# 📚 Guia Completo de Onboarding - Stream Star

## Índice
1. [Visão Geral do Projeto](#visão-geral-do-projeto)
2. [Stack Tecnológico](#stack-tecnológico)
3. [Arquitetura do Sistema](#arquitetura-do-sistema)
4. [Estrutura de Pastas](#estrutura-de-pastas)
5. [Sistema de Design](#sistema-de-design)
6. [Banco de Dados](#banco-de-dados)
7. [Autenticação](#autenticação)
8. [Sistema de Lives/Streaming](#sistema-de-livesstreaming)
9. [Sistema de Pagamentos](#sistema-de-pagamentos)
10. [Sistema de Afiliados](#sistema-de-afiliados)
11. [Edge Functions](#edge-functions)
12. [Padrões de Código](#padrões-de-código)
13. [Fluxos Principais](#fluxos-principais)

---

## 1. Visão Geral do Projeto

**Stream Star** é uma plataforma de streaming ao vivo onde:
- **Criadores** fazem lives e ganham dinheiro
- **Espectadores** assistem lives e gastam créditos
- **Afiliados** indicam usuários e ganham comissões

### Modelo de Negócio
```
Espectador compra créditos → Assiste live → Créditos são consumidos
                                              ↓
                          Criador recebe % → Plataforma recebe %
                                              ↓
                          Afiliado recebe % (se houver indicação)
```

---

## 2. Stack Tecnológico

### Frontend
| Tecnologia | Uso | Documentação |
|------------|-----|--------------|
| **React 18** | Framework principal | [react.dev](https://react.dev) |
| **TypeScript** | Tipagem estática | [typescriptlang.org](https://typescriptlang.org) |
| **Vite** | Build tool e dev server | [vitejs.dev](https://vitejs.dev) |
| **Tailwind CSS** | Estilização | [tailwindcss.com](https://tailwindcss.com) |
| **shadcn/ui** | Componentes UI | [ui.shadcn.com](https://ui.shadcn.com) |
| **React Router** | Roteamento SPA | [reactrouter.com](https://reactrouter.com) |
| **TanStack Query** | Cache e fetching | [tanstack.com/query](https://tanstack.com/query) |
| **Framer Motion** | Animações | [framer.com/motion](https://framer.com/motion) |

### Backend (Lovable Cloud / Supabase)
| Tecnologia | Uso |
|------------|-----|
| **Supabase** | BaaS (Backend as a Service) |
| **PostgreSQL** | Banco de dados |
| **Edge Functions** | Lógica serverless (Deno) |
| **Realtime** | WebSockets para chat e status |
| **Storage** | Armazenamento de arquivos |
| **Auth** | Autenticação de usuários |

### Streaming
| Tecnologia | Uso |
|------------|-----|
| **LiveKit** | Servidor WebRTC para vídeo/áudio |
| **livekit-client** | SDK cliente para streaming |

### Pagamentos
| Tecnologia | Uso |
|------------|-----|
| **Mercado Pago** | Processamento de pagamentos |
| **Woovi/OpenPix** | Pagamentos PIX |

---

## 3. Arquitetura do Sistema

### Diagrama de Arquitetura

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │   Páginas    │  │  Componentes │  │        Hooks             │  │
│  │  (src/pages) │  │(src/components│  │     (src/hooks)          │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
│                              │                                       │
│  ┌───────────────────────────┴───────────────────────────────────┐  │
│  │                    Supabase Client                             │  │
│  │              (src/integrations/supabase/client.ts)             │  │
│  └───────────────────────────┬───────────────────────────────────┘  │
└──────────────────────────────┼───────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      LOVABLE CLOUD (Supabase)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │   Database   │  │   Realtime   │  │     Edge Functions       │  │
│  │ (PostgreSQL) │  │ (WebSockets) │  │        (Deno)            │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐                                 │
│  │   Storage    │  │     Auth     │                                 │
│  │   (Files)    │  │   (Users)    │                                 │
│  └──────────────┘  └──────────────┘                                 │
└─────────────────────────────────────────────────────────────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
     ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
     │   LiveKit    │  │ Mercado Pago │  │    Woovi     │
     │   (Video)    │  │  (Payments)  │  │    (PIX)     │
     └──────────────┘  └──────────────┘  └──────────────┘
```

### Fluxo de Dados

```
Usuario interage → React Component → Hook/Service → Supabase Client
                                                          │
                                                          ▼
                                                    PostgreSQL/
                                                    Edge Function
                                                          │
                                                          ▼
                                              Resposta → Atualiza UI
```

---

## 4. Estrutura de Pastas

```
stream-star/
├── src/                          # Código fonte do frontend
│   ├── components/               # Componentes React
│   │   ├── ui/                   # Componentes base (shadcn)
│   │   ├── admin/                # Componentes do painel admin
│   │   ├── affiliate/            # Componentes de afiliados
│   │   ├── carousel/             # Componentes do carrossel
│   │   ├── chat/                 # Componentes de chat
│   │   ├── creator/              # Componentes do painel criador
│   │   ├── live/                 # Componentes de lives
│   │   ├── live-monitor/         # Monitor de lives (admin)
│   │   ├── revenue/              # Dashboard de receita
│   │   ├── user/                 # Componentes do usuário
│   │   └── webrtc/               # Componentes de streaming
│   │
│   ├── contexts/                 # React Contexts
│   │   ├── AuthContext.tsx       # Estado de autenticação
│   │   ├── CreditsContext.tsx    # Estado de créditos
│   │   └── SidebarContext.tsx    # Estado da sidebar
│   │
│   ├── hooks/                    # Custom Hooks
│   │   ├── useAuth.ts            # Hook de autenticação
│   │   ├── useCreatorDashboard.ts# Dashboard do criador
│   │   ├── useLiveMonitor.ts     # Monitor de lives
│   │   └── ...
│   │
│   ├── lib/                      # Utilitários e serviços
│   │   ├── api.ts                # Configuração de API
│   │   ├── i18n.ts               # Internacionalização
│   │   ├── payments.ts           # Lógica de pagamentos
│   │   └── ...
│   │
│   ├── pages/                    # Páginas/Rotas
│   │   ├── Index.tsx             # Homepage
│   │   ├── Auth.tsx              # Login/Signup
│   │   ├── Home.tsx              # Feed de lives
│   │   ├── LiveViewer.tsx        # Assistir live
│   │   ├── CreatorRoom.tsx       # Transmitir live
│   │   └── ...
│   │
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts         # Cliente Supabase (NÃO EDITAR)
│   │       └── types.ts          # Tipos do banco (NÃO EDITAR)
│   │
│   ├── index.css                 # Design system (CSS variables)
│   ├── App.tsx                   # Componente raiz
│   └── main.tsx                  # Entry point
│
├── supabase/                     # Backend Supabase
│   ├── functions/                # Edge Functions
│   │   ├── create-payment/       # Criar pagamento
│   │   ├── livekit-room/         # Token LiveKit
│   │   ├── mercadopago-webhook/  # Webhook MP
│   │   ├── viewer-heartbeat/     # Heartbeat de viewers
│   │   └── ...
│   │
│   ├── migrations/               # Migrações do banco (NÃO EDITAR)
│   └── config.toml               # Config Supabase (NÃO EDITAR)
│
├── backend/                      # Backend Express (auxiliar)
│   ├── src/
│   │   ├── controllers/          # Controllers da API
│   │   ├── routes/               # Rotas da API
│   │   ├── services/             # Lógica de negócio
│   │   └── middleware/           # Middlewares
│   └── index.ts                  # Entry point
│
├── docs/                         # Documentação
├── public/                       # Assets estáticos
├── tailwind.config.ts            # Configuração Tailwind
└── vite.config.ts                # Configuração Vite
```

---

## 5. Sistema de Design

### Conceito: Design Tokens

O projeto usa **CSS Variables** (Custom Properties) como tokens de design. Isso permite:
- Tema consistente em toda aplicação
- Fácil troca de tema (dark/light)
- Manutenção centralizada

### Arquivo Principal: `src/index.css`

```css
:root {
  /* Cores principais (HSL) */
  --background: 0 0% 0%;           /* Preto puro */
  --foreground: 0 0% 100%;         /* Branco puro */
  
  /* Cor primária: Roxo */
  --primary: 270 70% 55%;          /* Roxo vibrante */
  --primary-foreground: 0 0% 100%; /* Texto branco sobre roxo */
  --primary-glow: 270 70% 70%;     /* Versão mais clara para glow */
  
  /* Cor secundária */
  --secondary: 270 50% 45%;
  
  /* Estados */
  --success: 142 76% 50%;          /* Verde */
  --destructive: 0 84% 70%;        /* Vermelho */
  
  /* UI */
  --border: 0 0% 25%;
  --input: 0 0% 20%;
  --ring: 270 70% 60%;             /* Foco */
  
  /* Gradientes */
  --gradient-primary: linear-gradient(135deg, hsl(270 70% 50%), hsl(270 70% 65%));
  --gradient-logo: linear-gradient(90deg, hsl(330 90% 60%), hsl(25 95% 55%), hsl(270 80% 60%));
}
```

### Como Usar no Código

```tsx
// ❌ ERRADO - Nunca use cores diretas
<div className="bg-purple-500 text-white">

// ✅ CORRETO - Use tokens do design system
<div className="bg-primary text-primary-foreground">

// ✅ CORRETO - Para gradientes
<div className="bg-gradient-to-r from-[hsl(var(--logo-pink))] to-[hsl(var(--logo-purple))]">
```

### Tailwind Config: `tailwind.config.ts`

```typescript
// As cores são mapeadas para usar as CSS variables
colors: {
  background: "hsl(var(--background))",
  foreground: "hsl(var(--foreground))",
  primary: {
    DEFAULT: "hsl(var(--primary))",
    foreground: "hsl(var(--primary-foreground))",
  },
  // ...
}
```

### Componentes shadcn/ui

Localização: `src/components/ui/`

Componentes base pré-estilizados:
- `button.tsx` - Botões com variantes
- `card.tsx` - Cards
- `dialog.tsx` - Modais
- `input.tsx` - Inputs
- `toast.tsx` - Notificações
- etc.

**Exemplo de uso:**
```tsx
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

<Card>
  <CardHeader>
    <CardTitle>Título</CardTitle>
  </CardHeader>
  <CardContent>
    <Button variant="default">Primário</Button>
    <Button variant="secondary">Secundário</Button>
    <Button variant="destructive">Deletar</Button>
    <Button variant="ghost">Ghost</Button>
  </CardContent>
</Card>
```

### Animações

Definidas em `tailwind.config.ts`:

```typescript
keyframes: {
  "fade-in": {
    "0%": { opacity: "0", transform: "translateY(10px)" },
    "100%": { opacity: "1", transform: "translateY(0)" }
  },
  "scale-in": {
    "0%": { transform: "scale(0.95)", opacity: "0" },
    "100%": { transform: "scale(1)", opacity: "1" }
  },
  // ...
}
```

**Uso:**
```tsx
<div className="animate-fade-in">Conteúdo que aparece suavemente</div>
```

---

## 6. Banco de Dados

### Conceitos Importantes

1. **PostgreSQL**: Banco de dados relacional
2. **RLS (Row Level Security)**: Políticas de segurança por linha
3. **Realtime**: Mudanças são transmitidas via WebSocket

### Principais Tabelas

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              USUÁRIOS                                    │
├─────────────────────────────────────────────────────────────────────────┤
│ profiles           │ Dados públicos do usuário (username, avatar, bio)  │
│ user_roles         │ Roles do usuário (admin, creator)                  │
│ creator_profiles   │ Dados específicos de criadores                     │
│ credits_wallet     │ Carteira de créditos do usuário                    │
│ creator_wallet     │ Carteira do criador (ganhos)                       │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                               LIVES                                      │
├─────────────────────────────────────────────────────────────────────────┤
│ lives              │ Sessões de live (título, status, criador)          │
│ live_consumption   │ Consumo de créditos por viewer                     │
│ live_access        │ Controle de acesso a lives                         │
│ rooms              │ Salas de chat                                       │
│ messages           │ Mensagens do chat                                   │
│ superchats         │ SuperChats enviados                                 │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                            FINANCEIRO                                    │
├─────────────────────────────────────────────────────────────────────────┤
│ payments           │ Pagamentos de usuários                              │
│ transactions       │ Todas as transações                                 │
│ credit_purchases   │ Compras de créditos                                 │
│ creator_earnings   │ Ganhos dos criadores por live                       │
│ payout_requests    │ Solicitações de saque                               │
│ platform_revenue   │ Receita da plataforma                               │
│ financial_settings │ Configurações de percentuais                        │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                            AFILIADOS                                     │
├─────────────────────────────────────────────────────────────────────────┤
│ referrals          │ Indicações feitas                                   │
│ registration_referrals │ Indicações durante registro                    │
│ affiliate_logs     │ Log de comissões de afiliados                       │
│ commissions        │ Comissões pagas                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### Exemplo: Tabela `profiles`

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,              -- Mesmo ID do auth.users
  username TEXT NOT NULL UNIQUE,    -- Nome de usuário
  avatar_url TEXT,                  -- URL do avatar
  bio TEXT,                         -- Biografia
  is_subscribed BOOLEAN,            -- Assinante ativo?
  referral_code TEXT UNIQUE,        -- Código de indicação
  referred_by TEXT,                 -- Quem indicou
  status TEXT,                      -- 'active', 'blocked'
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Política RLS: Usuário só pode editar seu próprio perfil
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Política RLS: Qualquer um pode ver perfis (públicos)
CREATE POLICY "Profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);
```

### Como Acessar o Banco (Frontend)

```typescript
import { supabase } from "@/integrations/supabase/client";

// SELECT
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId)
  .single();

// INSERT
const { error } = await supabase
  .from('messages')
  .insert({ room_id: roomId, content: text, user_id: userId });

// UPDATE
const { error } = await supabase
  .from('profiles')
  .update({ bio: 'Nova bio' })
  .eq('id', userId);

// DELETE
const { error } = await supabase
  .from('messages')
  .delete()
  .eq('id', messageId);

// Realtime (escutar mudanças)
const channel = supabase
  .channel('messages')
  .on('postgres_changes', 
    { event: 'INSERT', schema: 'public', table: 'messages' },
    (payload) => {
      console.log('Nova mensagem:', payload.new);
    }
  )
  .subscribe();
```

---

## 7. Autenticação

### Fluxo de Autenticação

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Usuário   │───▶│   /auth     │───▶│  Supabase   │
│  (Browser)  │    │   (React)   │    │    Auth     │
└─────────────┘    └─────────────┘    └─────────────┘
                          │                   │
                          │    JWT Token      │
                          │◀──────────────────│
                          │                   │
                   ┌──────▼──────┐           │
                   │ AuthContext │           │
                   │  (Session)  │           │
                   └─────────────┘           │
```

### Componentes Envolvidos

1. **`src/contexts/AuthContext.tsx`** - Provider de autenticação
2. **`src/pages/Auth.tsx`** - Página de login/signup
3. **`src/components/ProtectedRoute.tsx`** - Proteção de rotas

### Implementação do AuthContext

```typescript
// src/contexts/AuthContext.tsx
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Escutar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    // 2. Verificar sessão existente
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Funções de autenticação
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email, password
    });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/` }
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
```

### Uso nos Componentes

```typescript
// Usando o hook useAuth
import { useAuth } from "@/hooks/useAuth";

function MyComponent() {
  const { user, session, loading, signOut } = useAuth();

  if (loading) return <Loading />;
  if (!user) return <Navigate to="/auth" />;

  return (
    <div>
      <p>Bem-vindo, {user.email}</p>
      <button onClick={signOut}>Sair</button>
    </div>
  );
}
```

### Proteção de Rotas

```typescript
// src/components/ProtectedRoute.tsx
export const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <PageLoading />;
  if (!user) return <Navigate to="/auth" replace />;
  
  return children;
};

// Uso no App.tsx
<Route path="/dashboard" element={
  <ProtectedRoute>
    <Dashboard />
  </ProtectedRoute>
} />
```

---

## 8. Sistema de Lives/Streaming

### Arquitetura de Streaming

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            CRIADOR                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  CreatorRoom.tsx → WebRTCPublisher.tsx → LiveKit Client          │   │
│  │       ↓                    ↓                    ↓                │   │
│  │  Configura live      Captura câmera/     Envia para              │   │
│  │  (título, thumb)     microfone           LiveKit Cloud           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                           ┌────────────────┐
                           │  LiveKit Cloud  │
                           │   (WebRTC SFU)  │
                           └────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           ESPECTADOR                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  LiveViewer.tsx → WebRTCViewer.tsx → LiveKit Client              │   │
│  │       ↓                   ↓                   ↓                  │   │
│  │  Mostra player      Recebe stream       Conecta ao               │   │
│  │  + chat             de vídeo            LiveKit Cloud            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Fluxo Detalhado

#### 1. Criador Inicia Live

```typescript
// CreatorRoom.tsx
// 1. Cria registro da live no banco
const { data: live } = await supabase
  .from('lives')
  .insert({
    creator_id: user.id,
    title: 'Minha Live',
    status: 'waiting',
    is_active: true
  })
  .select()
  .single();

// 2. Solicita token do LiveKit via Edge Function
const response = await supabase.functions.invoke('livekit-room', {
  body: { 
    roomName: live.webrtc_room_name,
    identity: user.id,
    isPublisher: true 
  }
});
const { token } = response.data;

// 3. Conecta ao LiveKit e publica
const room = new Room();
await room.connect(LIVEKIT_URL, token);
await room.localParticipant.setCameraEnabled(true);
await room.localParticipant.setMicrophoneEnabled(true);
```

#### 2. Espectador Assiste

```typescript
// LiveViewer.tsx
// 1. Busca dados da live
const { data: live } = await supabase
  .from('lives')
  .select('*, creator_profiles(*)')
  .eq('id', liveId)
  .single();

// 2. Solicita token de viewer
const response = await supabase.functions.invoke('livekit-room', {
  body: { 
    roomName: live.webrtc_room_name,
    identity: user.id,
    isPublisher: false 
  }
});

// 3. Conecta e recebe stream
const room = new Room();
await room.connect(LIVEKIT_URL, token);

room.on(RoomEvent.TrackSubscribed, (track) => {
  if (track.kind === 'video') {
    track.attach(videoElement);
  }
});
```

#### 3. Sistema de Créditos (Heartbeat)

```typescript
// Viewer envia heartbeat a cada 5 segundos
useEffect(() => {
  const interval = setInterval(async () => {
    await supabase.functions.invoke('viewer-heartbeat', {
      body: { liveId, sessionToken }
    });
  }, 5000);

  return () => clearInterval(interval);
}, [liveId]);

// Edge Function viewer-heartbeat:
// - Verifica se passou 1 minuto desde último débito
// - Debita 1 crédito do viewer
// - Credita proporcionalmente o criador
// - Registra em live_consumption
```

### Componentes de Streaming

| Componente | Localização | Função |
|------------|-------------|--------|
| `WebRTCPublisher` | `src/components/webrtc/` | Publicar stream (criador) |
| `WebRTCViewer` | `src/components/webrtc/` | Receber stream (viewer) |
| `CreatorRoom` | `src/pages/` | Página do criador transmitindo |
| `LiveViewer` | `src/pages/` | Página do viewer assistindo |
| `FloatingLiveChat` | `src/components/live/` | Chat da live |

---

## 9. Sistema de Pagamentos

### Fluxo de Compra de Créditos

```
┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Usuário   │───▶│  create-payment │───▶│   Mercado Pago  │
│  clica em   │    │  Edge Function  │    │    ou Woovi     │
│  "Comprar"  │    └─────────────────┘    └─────────────────┘
└─────────────┘                                    │
                                                   │ Webhook
                                                   ▼
                                    ┌─────────────────────────┐
                                    │  mercadopago-webhook    │
                                    │  ou woovi-webhook       │
                                    └─────────────────────────┘
                                                   │
                                                   ▼
                                    ┌─────────────────────────┐
                                    │  credits_wallet UPDATE  │
                                    │  (adiciona créditos)    │
                                    └─────────────────────────┘
```

### Edge Function: create-payment

```typescript
// supabase/functions/create-payment/index.ts
Deno.serve(async (req) => {
  const { credits, userId, paymentMethod } = await req.json();
  
  // Calcula valor (ex: 100 créditos = R$ 10)
  const amount = credits * 0.10;
  
  if (paymentMethod === 'mercadopago') {
    // Cria preferência no Mercado Pago
    const preference = await mercadoPago.preferences.create({
      items: [{ title: `${credits} créditos`, unit_price: amount }],
      external_reference: paymentId,
      notification_url: `${SUPABASE_URL}/functions/v1/mercadopago-webhook`
    });
    
    return { init_point: preference.init_point };
  }
  
  if (paymentMethod === 'pix') {
    // Cria cobrança PIX via Woovi
    const charge = await woovi.createCharge({
      value: amount * 100, // centavos
      correlationID: paymentId
    });
    
    return { qrcode: charge.qrCodeImage, pixCode: charge.brCode };
  }
});
```

### Webhook: Confirmação de Pagamento

```typescript
// supabase/functions/mercadopago-webhook/index.ts
Deno.serve(async (req) => {
  const notification = await req.json();
  
  // Verifica assinatura do webhook
  if (!verifySignature(req, notification)) {
    return new Response('Invalid signature', { status: 401 });
  }
  
  if (notification.action === 'payment.updated') {
    const payment = await mercadoPago.payment.get(notification.data.id);
    
    if (payment.status === 'approved') {
      // Adiciona créditos ao usuário
      await supabase
        .from('credits_wallet')
        .update({ 
          balance_credits: supabase.sql`balance_credits + ${credits}` 
        })
        .eq('user_id', userId);
      
      // Registra transação
      await supabase
        .from('credit_purchases')
        .update({ status: 'completed' })
        .eq('payment_id', paymentId);
    }
  }
  
  return new Response('OK');
});
```

### Fluxo de Saque (Criador)

```
┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Criador   │───▶│ payout_requests │───▶│     Admin       │
│  solicita   │    │    (pending)    │    │   aprova/nega   │
│   saque     │    └─────────────────┘    └─────────────────┘
└─────────────┘                                    │
                                                   │ Se aprovado
                                                   ▼
                                    ┌─────────────────────────┐
                                    │   process-pix-payout    │
                                    │   Edge Function         │
                                    └─────────────────────────┘
                                                   │
                                                   ▼
                                    ┌─────────────────────────┐
                                    │       PIX enviado       │
                                    │   creator_wallet UPDATE │
                                    └─────────────────────────┘
```

---

## 10. Sistema de Afiliados

### Modelo de Comissões

```
Usuário A indica Usuário B
Usuário B indica Usuário C

Quando C compra créditos:
├── C paga R$ 100
├── Plataforma recebe R$ 50 (50%)
├── Criador recebe R$ 40 (40%)
├── B (afiliado direto) recebe R$ 7 (7%)
└── A (afiliado raiz) recebe R$ 3 (3%)
```

### Tabelas Envolvidas

```sql
-- Código de indicação no perfil
profiles.referral_code   -- Ex: "JOAO2024"
profiles.referred_by     -- ID de quem indicou
profiles.referrer_direct -- ID do afiliado direto
profiles.referrer_root   -- ID do afiliado raiz (criador)

-- Registro de indicações
referrals:
  id, referrer_id, referred_id, referral_code, status, commission_earned

-- Log de comissões
affiliate_logs:
  id, event_type, new_user, direct_referrer, root_creator, 
  amount_direct, amount_root, amount_platform
```

### Fluxo de Registro com Indicação

```typescript
// 1. Usuário acessa link: /subscribe?ref=JOAO2024

// 2. No registro, valida código
const { data: referrer } = await supabase
  .from('profiles')
  .select('id, username, is_root_creator')
  .eq('referral_code', 'JOAO2024')
  .single();

// 3. Se válido, armazena no perfil do novo usuário
await supabase.from('profiles').update({
  referred_by: 'JOAO2024',
  referrer_direct: referrer.id,
  referrer_root: referrer.is_root_creator ? referrer.id : referrer.referrer_root
}).eq('id', newUserId);

// 4. Registra na tabela referrals
await supabase.from('referrals').insert({
  referrer_id: referrer.id,
  referred_id: newUserId,
  referral_code: 'JOAO2024',
  status: 'active'
});
```

### Componentes de Afiliados

| Componente | Função |
|------------|--------|
| `ReferralLinkBox` | Mostra e copia link de indicação |
| `CompactReferralCodeBox` | Criar/editar código de indicação |
| `AffiliateDashboardPanel` | Dashboard de ganhos do afiliado |
| `HowToMonetizeDialog` | Explica como ganhar indicando |

---

## 11. Edge Functions

### O que são Edge Functions?

São funções serverless que rodam no servidor (Deno runtime). Usamos para:
- Lógica que precisa de segredos (API keys)
- Webhooks de serviços externos
- Operações que precisam ser seguras

### Localização

```
supabase/functions/
├── create-payment/          # Criar pagamento MP/Woovi
├── create-superchat-payment/# Pagamento de SuperChat
├── livekit-room/            # Gerar token LiveKit
├── mercadopago-webhook/     # Receber webhook MP
├── woovi-payment-webhook/   # Receber webhook Woovi
├── viewer-heartbeat/        # Heartbeat de viewers
├── pix-withdraw/            # Processar saque PIX
├── monitor-lives/           # Monitorar lives ativas
├── password-reset/          # Reset de senha
└── admin-set-password/      # Admin define senha
```

### Estrutura de uma Edge Function

```typescript
// supabase/functions/minha-funcao/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Criar cliente Supabase com service role (acesso total)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Pegar dados do request
    const { userId, amount } = await req.json();

    // Fazer operações no banco
    const { data, error } = await supabase
      .from('credits_wallet')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

### Como Chamar Edge Functions

```typescript
// No frontend
import { supabase } from "@/integrations/supabase/client";

const { data, error } = await supabase.functions.invoke('minha-funcao', {
  body: { userId: '123', amount: 100 }
});

if (error) {
  console.error('Erro:', error);
} else {
  console.log('Sucesso:', data);
}
```

---

## 12. Padrões de Código

### Estrutura de Componentes

```typescript
// src/components/MeuComponente.tsx
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface MeuComponenteProps {
  userId: string;
  onSuccess?: () => void;
}

export const MeuComponente = ({ userId, onSuccess }: MeuComponenteProps) => {
  // 1. Hooks primeiro
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DataType | null>(null);
  const { toast } = useToast();

  // 2. Effects
  useEffect(() => {
    fetchData();
  }, [userId]);

  // 3. Funções
  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tabela')
      .select('*')
      .eq('user_id', userId);
    
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      setData(data);
    }
    setLoading(false);
  };

  const handleClick = async () => {
    // lógica
    onSuccess?.();
  };

  // 4. Render
  if (loading) return <div>Carregando...</div>;

  return (
    <div className="p-4 bg-card rounded-lg">
      <h2 className="text-foreground">Título</h2>
      <Button onClick={handleClick}>Ação</Button>
    </div>
  );
};
```

### Hooks Customizados

```typescript
// src/hooks/useMeuHook.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseMeuHookResult {
  data: DataType[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export const useMeuHook = (userId: string): UseMeuHookResult => {
  const [data, setData] = useState<DataType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    const { data, error } = await supabase
      .from('tabela')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      setError(error);
    } else {
      setData(data || []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
};
```

### Serviços (lib)

```typescript
// src/lib/meuService.ts
import { supabase } from '@/integrations/supabase/client';

export interface CreateItemParams {
  name: string;
  userId: string;
}

export const createItem = async (params: CreateItemParams) => {
  const { data, error } = await supabase
    .from('items')
    .insert(params)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getItems = async (userId: string) => {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};
```

### Convenções de Nomenclatura

| Tipo | Convenção | Exemplo |
|------|-----------|---------|
| Componentes | PascalCase | `LiveViewer.tsx` |
| Hooks | camelCase com "use" | `useLiveMonitor.ts` |
| Serviços | camelCase + "Service" | `paymentsService.ts` |
| Tipos/Interfaces | PascalCase | `LiveData`, `UserProfile` |
| Constantes | UPPER_SNAKE_CASE | `API_BASE_URL` |
| Funções | camelCase | `fetchLiveData()` |
| CSS classes | kebab-case | `live-viewer-container` |

---

## 13. Fluxos Principais

### Fluxo 1: Usuário Novo Assiste Live

```
1. Acessa site (Index.tsx)
   ↓
2. Vê lista de lives (Home.tsx)
   ↓
3. Clica em uma live
   ↓
4. Modal pede login (não autenticado)
   ↓
5. Vai para /auth (Auth.tsx)
   ↓
6. Faz signup com email/senha
   ↓
7. É redirecionado para /subscribe
   ↓
8. Paga assinatura (ou usa código gratuito)
   ↓
9. Ganha créditos iniciais
   ↓
10. Volta para live (LiveViewer.tsx)
    ↓
11. Conecta ao LiveKit (WebRTCViewer)
    ↓
12. Assiste e gasta créditos (heartbeat)
    ↓
13. Quando créditos acabam → PaywallOverlay
    ↓
14. Compra mais créditos ou sai
```

### Fluxo 2: Criador Faz Live

```
1. Criador logado acessa /creator-room
   ↓
2. Configura título e thumbnail (LiveConfigPanel)
   ↓
3. Clica "Iniciar Transmissão"
   ↓
4. Sistema cria registro em 'lives' (status: waiting)
   ↓
5. Edge Function gera token LiveKit
   ↓
6. WebRTCPublisher conecta ao LiveKit
   ↓
7. Câmera/microfone são ativados
   ↓
8. Live muda para status: 'live'
   ↓
9. Viewers podem entrar
   ↓
10. Chat funciona via Supabase Realtime
    ↓
11. SuperChats aparecem (SuperChatQueue)
    ↓
12. Criador clica "Encerrar"
    ↓
13. Desconecta do LiveKit
    ↓
14. Live muda para status: 'ended'
    ↓
15. Ganhos são calculados (creator_earnings)
```

### Fluxo 3: Afiliado Indica Usuário

```
1. Afiliado cria código (CompactReferralCodeBox)
   ↓
2. Sistema salva em profiles.referral_code
   ↓
3. Afiliado compartilha link: /subscribe?ref=CODIGO
   ↓
4. Novo usuário acessa link
   ↓
5. Código é validado via API
   ↓
6. Novo usuário completa cadastro
   ↓
7. profiles.referred_by = CODIGO
   ↓
8. Registro criado em 'referrals'
   ↓
9. Quando novo usuário compra créditos:
   ├── Plataforma registra transação
   ├── Calcula comissão do afiliado
   ├── Credita em affiliate_earnings
   └── Registra em affiliate_logs
   ↓
10. Afiliado vê ganhos no dashboard
```

---

## Comandos Úteis

```bash
# Desenvolvimento
npm run dev              # Inicia servidor de desenvolvimento

# Build
npm run build            # Gera build de produção
npm run preview          # Preview do build

# Testes
npm run test             # Roda testes

# Tipos do Supabase (automático)
# Os tipos são gerados automaticamente pelo Lovable
```

---

## Dicas para Novos Desenvolvedores

1. **Nunca edite arquivos automáticos**:
   - `src/integrations/supabase/client.ts`
   - `src/integrations/supabase/types.ts`
   - `supabase/config.toml`
   - `supabase/migrations/*`

2. **Sempre use o design system**:
   - Classes Tailwind com tokens (`bg-primary`, não `bg-purple-500`)
   - Componentes do shadcn/ui

3. **Debugging**:
   - Console do browser para erros frontend
   - Logs das Edge Functions no painel Lovable Cloud
   - Tabela `webhook_logs` para problemas de pagamento

4. **Teste localmente**:
   - Crie uma conta de teste
   - Use códigos de cupom para créditos gratuitos
   - Mercado Pago tem ambiente sandbox

5. **Pergunte antes de mudar**:
   - Tabelas do banco afetam muitas coisas
   - Edge Functions são críticas (pagamentos, etc.)

---

## Recursos Adicionais

- [Documentação React](https://react.dev)
- [Documentação Supabase](https://supabase.com/docs)
- [Documentação Tailwind](https://tailwindcss.com/docs)
- [Documentação shadcn/ui](https://ui.shadcn.com)
- [Documentação LiveKit](https://docs.livekit.io)
- [API Mercado Pago](https://www.mercadopago.com.br/developers)

---

*Documento gerado em Dezembro/2024*
*Projeto: Stream Star*
