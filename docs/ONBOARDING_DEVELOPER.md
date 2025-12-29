# 📚 Documentação Técnica - Plataforma de Streaming

> **Para quem é este documento?**  
> Programadores que estão entrando no projeto e precisam entender rapidamente como ele foi construído, quais tecnologias foram usadas e onde encontrar cada parte do código.

---

## 🗺️ Guia Rápido de Navegação

### Estrutura de Pastas do Projeto

```
📁 projeto/
├── 📁 src/                      ← TODO O CÓDIGO FRONTEND
│   ├── 📁 components/           ← Componentes React reutilizáveis
│   │   ├── 📁 ui/               ← Botões, Cards, Dialogs (primitivas)
│   │   ├── 📁 chat/             ← Componentes de chat
│   │   ├── 📁 admin/            ← Componentes do painel admin
│   │   └── 📁 creator/          ← Componentes para criadores
│   ├── 📁 pages/                ← Páginas (cada arquivo = uma rota)
│   ├── 📁 hooks/                ← Lógica reutilizável (useAuth, useLanguage)
│   ├── 📁 contexts/             ← Estado global (AuthContext, CreditsContext)
│   ├── 📁 lib/                  ← Utilitários e serviços
│   └── 📁 integrations/         ← Conexão com Supabase
│
├── 📁 supabase/
│   └── 📁 functions/            ← EDGE FUNCTIONS (backend serverless)
│       ├── create-payment/      ← Criar pagamentos
│       ├── mercadopago-webhook/ ← Receber webhooks
│       └── livekit-room/        ← Gerenciar salas de streaming
│
├── 📁 public/                   ← Arquivos estáticos (imagens, favicon)
├── 📁 docs/                     ← Documentação (você está aqui!)
├── 📄 index.html                ← Ponto de entrada HTML
├── 📄 tailwind.config.ts        ← Configuração do Tailwind CSS
└── 📄 src/index.css             ← Design tokens (cores, fontes)
```

### Onde Encontrar Cada Coisa

| Preciso de... | Onde está | Arquivo(s) principal(is) |
|---------------|-----------|--------------------------|
| **Cores e tema** | Design System | `src/index.css`, `tailwind.config.ts` |
| **Componentes visuais** | UI Components | `src/components/ui/` |
| **Páginas do app** | Pages | `src/pages/` |
| **Rotas da aplicação** | Router | `src/App.tsx` |
| **Autenticação** | Auth Context | `src/contexts/AuthContext.tsx` |
| **Traduções** | i18n | `src/lib/i18n.ts`, `src/hooks/useLanguage.tsx` |
| **Tipos do banco** | Supabase Types | `src/integrations/supabase/types.ts` |
| **Cliente Supabase** | Supabase Client | `src/integrations/supabase/client.ts` |
| **Lógica de backend** | Edge Functions | `supabase/functions/` |
| **Queries de dados** | Hooks | `src/hooks/use*.ts` |

---

## 📖 Glossário de Termos

### Termos Gerais de Programação

| Termo | O que significa |
|-------|-----------------|
| **Frontend** | A parte visual que o usuário vê e interage (interface) |
| **Backend** | A parte que roda no servidor (lógica, banco de dados) |
| **API** | Interface que permite comunicação entre sistemas |
| **SPA** | Single Page Application - site que não recarrega ao navegar |
| **Hook** | Função especial do React para reutilizar lógica |
| **Componente** | Pedaço de interface reutilizável (ex: botão, card) |
| **Estado (State)** | Dados que podem mudar e fazem a tela atualizar |
| **Props** | Dados passados de um componente pai para filho |
| **Context** | Forma de compartilhar dados sem passar por props |

### Termos Específicos do Projeto

| Termo | O que significa |
|-------|-----------------|
| **Supabase** | Plataforma BaaS (Backend as a Service) usada no projeto |
| **Edge Function** | Código que roda no servidor da Supabase (serverless) |
| **RLS** | Row Level Security - regras de quem pode ver/editar dados |
| **JWT** | Token seguro usado para autenticação |
| **WebRTC** | Protocolo para streaming de vídeo em tempo real |
| **LiveKit** | Serviço que gerencia as chamadas de vídeo/streaming |
| **Webhook** | URL que recebe notificações automáticas de eventos |
| **PIX** | Sistema de pagamento instantâneo brasileiro |
| **Tailwind** | Framework CSS que usa classes utilitárias |
| **shadcn/ui** | Biblioteca de componentes React pré-estilizados |
| **Zod** | Biblioteca para validar dados com TypeScript |
| **TanStack Query** | Biblioteca para gerenciar dados do servidor |

### Siglas Importantes

| Sigla | Significado |
|-------|-------------|
| **TS/TSX** | TypeScript / TypeScript com JSX (React) |
| **CSS** | Cascading Style Sheets (estilização) |
| **SQL** | Structured Query Language (linguagem de banco) |
| **UUID** | Identificador único universal (ex: `a1b2c3d4-...`) |
| **HSL** | Hue-Saturation-Lightness (formato de cor) |
| **HMR** | Hot Module Replacement (atualização sem recarregar) |
| **CRUD** | Create, Read, Update, Delete (operações básicas) |
| **BaaS** | Backend as a Service |
| **i18n** | Internacionalização (internationalization) |
| **SSR** | Server-Side Rendering |
| **SFU** | Selective Forwarding Unit (arquitetura de streaming) |

---

## 📑 Índice Detalhado

### Parte 1: Fundamentos
| # | Seção | O que você vai aprender |
|---|-------|------------------------|
| 1 | [Linguagens e Tecnologias](#1-linguagens-e-tecnologias) | TypeScript, SQL, CSS, ambientes de execução |
| 2 | [Bibliotecas e Dependências](#2-bibliotecas-e-dependências) | React, Tailwind, Supabase, todas as libs usadas |
| 3 | [Arquitetura da Aplicação](#3-arquitetura-da-aplicação) | Como as partes se conectam, estrutura de pastas |

### Parte 2: Padrões e Sistema Visual
| # | Seção | O que você vai aprender |
|---|-------|------------------------|
| 4 | [Padrões de Design](#4-padrões-de-design) | Composition, Provider, Container/Presentational |
| 5 | [Sistema de Design](#5-sistema-de-design) | CSS Variables, Tailwind, CVA, Design Tokens |
| 6 | [Internacionalização](#6-internacionalização-i18n) | Multi-idioma (PT/EN/ES), traduções, useLanguage |

### Parte 3: Dados e Segurança
| # | Seção | O que você vai aprender |
|---|-------|------------------------|
| 7 | [Banco de Dados](#7-banco-de-dados-relacional) | PostgreSQL, tabelas, RLS, queries Supabase |
| 8 | [Autenticação](#8-autenticação-e-autorização) | JWT, login/registro, proteção de rotas, RBAC |

### Parte 4: Comunicação em Tempo Real
| # | Seção | O que você vai aprender |
|---|-------|------------------------|
| 9 | [WebRTC e Streaming](#9-protocolo-webrtc-e-streaming) | Como funciona vídeo ao vivo, LiveKit, SFU |
| 10 | [Tempo Real](#10-comunicação-em-tempo-real) | WebSocket, Supabase Realtime, chat ao vivo |

### Parte 5: Backend e Integrações
| # | Seção | O que você vai aprender |
|---|-------|------------------------|
| 11 | [Serverless Functions](#11-serverless-functions) | Edge Functions, Deno, como criar endpoints |
| 12 | [Webhooks](#12-webhooks-e-integrações) | Mercado Pago, Woovi, receber notificações |

### Parte 6: Fluxos e Boas Práticas
| # | Seção | O que você vai aprender |
|---|-------|------------------------|
| 13 | [Fluxos de Dados](#13-fluxos-de-dados) | Compra de créditos, consumo, streaming |
| 14 | [Gerenciamento de Estado](#14-gerenciamento-de-estado) | Context API, TanStack Query, estados locais |
| 15 | [Padrões de Código](#15-padrões-de-código) | Convenções, nomenclatura, boas práticas |

---

## 🚀 Por Onde Começar?

### Se você é completamente iniciante:
1. Leia o [Glossário](#-glossário-de-termos) para entender os termos
2. Veja a [Arquitetura](#3-arquitetura-da-aplicação) para entender a estrutura
3. Explore a pasta `src/pages/` para ver as páginas do app
4. Olhe `src/components/ui/` para ver componentes básicos

### Se você já conhece React:
1. Veja os [Padrões de Design](#4-padrões-de-design) usados
2. Entenda o [Sistema de Design](#5-sistema-de-design)
3. Explore os hooks customizados em `src/hooks/`

### Se você vai trabalhar no backend:
1. Leia sobre [Edge Functions](#11-serverless-functions)
2. Entenda o [Banco de Dados](#7-banco-de-dados-relacional)
3. Veja como funcionam os [Webhooks](#12-webhooks-e-integrações)

### Se você vai trabalhar com streaming:
1. Leia sobre [WebRTC](#9-protocolo-webrtc-e-streaming)
2. Entenda a [Comunicação em Tempo Real](#10-comunicação-em-tempo-real)
3. Explore `src/components/webrtc/`

---

## 📚 Conteúdo Técnico Detalhado

---

## 1. Linguagens e Tecnologias

### Linguagens Utilizadas

| Linguagem | Uso | Característica |
|-----------|-----|----------------|
| **TypeScript** | Frontend e Backend | Superset do JavaScript com tipagem estática |
| **SQL** | Banco de dados | Linguagem de consulta para PostgreSQL |
| **CSS** | Estilização | Processado via Tailwind CSS |
| **HTML** | Estrutura | Gerado via JSX no React |

### TypeScript

TypeScript adiciona tipagem estática ao JavaScript, permitindo:

```typescript
// Definição de tipos
interface User {
  id: string;
  email: string;
  username: string;
  createdAt: Date;
}

// Função tipada
function getUser(id: string): Promise<User | null> {
  // implementação
}

// Generic types
type ApiResponse<T> = {
  data: T | null;
  error: Error | null;
};
```

**Benefícios:**
- Detecção de erros em tempo de desenvolvimento
- Autocompletion no editor
- Documentação implícita via tipos
- Refatoração mais segura

### Runtime Environments

| Ambiente | Onde roda | Engine |
|----------|-----------|--------|
| **Browser** | Cliente (React) | V8 (Chrome), SpiderMonkey (Firefox) |
| **Deno** | Servidor (Edge Functions) | V8 com runtime seguro |
| **Node.js** | Backend auxiliar | V8 com APIs nativas |

---

## 2. Bibliotecas e Dependências

### Frontend Core

| Biblioteca | Versão | Propósito |
|------------|--------|-----------|
| **React** | 18.x | Biblioteca de UI baseada em componentes |
| **React DOM** | 18.x | Renderização para navegador |
| **React Router** | 6.x | Roteamento SPA (Single Page Application) |
| **Vite** | 5.x | Build tool e dev server com HMR |

### Estado e Data Fetching

| Biblioteca | Propósito |
|------------|-----------|
| **TanStack Query** | Cache, fetching, sincronização de dados servidor |
| **React Context** | Estado global leve (auth, theme) |
| **useState/useReducer** | Estado local de componentes |

### UI e Estilização

| Biblioteca | Propósito |
|------------|-----------|
| **Tailwind CSS** | Framework CSS utility-first |
| **shadcn/ui** | Componentes acessíveis baseados em Radix |
| **Radix UI** | Primitivas de UI sem estilo |
| **class-variance-authority** | Variantes de componentes |
| **tailwind-merge** | Merge inteligente de classes |
| **clsx** | Concatenação condicional de classes |

### Formulários e Validação

| Biblioteca | Propósito |
|------------|-----------|
| **React Hook Form** | Gerenciamento de formulários performático |
| **Zod** | Validação de schemas com inferência de tipos |
| **@hookform/resolvers** | Integração Zod + React Hook Form |

### Streaming e Mídia

| Biblioteca | Propósito |
|------------|-----------|
| **livekit-client** | SDK WebRTC para streaming de vídeo/áudio |
| **MediaDevices API** | Acesso a câmera e microfone (nativo) |

### Backend como Serviço (BaaS)

| Biblioteca | Propósito |
|------------|-----------|
| **@supabase/supabase-js** | Cliente para Supabase (auth, db, realtime, storage) |

### Utilitários

| Biblioteca | Propósito |
|------------|-----------|
| **date-fns** | Manipulação de datas |
| **lucide-react** | Ícones SVG |
| **sonner** | Notificações toast |
| **embla-carousel-react** | Carrossel touch-friendly |
| **recharts** | Gráficos e visualizações |

---

## 3. Arquitetura da Aplicação

### Padrão Arquitetural: Client-Server com BaaS

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CAMADA DE APRESENTAÇÃO                           │
│                         (React SPA - Browser)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │   Pages     │  │ Components  │  │   Hooks     │  │  Contexts   │   │
│  │  (Rotas)    │  │    (UI)     │  │  (Lógica)   │  │  (Estado)   │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                         HTTP/WebSocket/WebRTC
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         CAMADA DE SERVIÇOS                              │
│                      (Supabase - PostgreSQL)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  Database   │  │    Auth     │  │  Realtime   │  │   Storage   │   │
│  │   (SQL)     │  │   (JWT)     │  │ (WebSocket) │  │   (Files)   │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Edge Functions (Deno)                         │   │
│  │              Lógica serverless para operações seguras            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       SERVIÇOS EXTERNOS                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                     │
│  │  LiveKit    │  │ Mercado Pago│  │   Woovi     │                     │
│  │  (WebRTC)   │  │  (Payments) │  │   (PIX)     │                     │
│  └─────────────┘  └─────────────┘  └─────────────┘                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### Estrutura de Diretórios

```
src/
├── components/           # Componentes React reutilizáveis
│   ├── ui/              # Primitivas de UI (Button, Card, Dialog)
│   └── [feature]/       # Componentes por funcionalidade
│
├── pages/               # Componentes de página (1:1 com rotas)
│
├── hooks/               # Custom hooks (lógica reutilizável)
│
├── contexts/            # React Contexts (estado global)
│
├── lib/                 # Utilitários e serviços
│   ├── utils.ts         # Funções helper genéricas
│   └── [service].ts     # Serviços de domínio
│
├── integrations/        # Integrações externas
│   └── supabase/        # Cliente e tipos Supabase
│
└── assets/              # Arquivos estáticos (imagens, fontes)
```

### Single Page Application (SPA)

O projeto usa o padrão SPA onde:
- Uma única página HTML é carregada inicialmente
- JavaScript gerencia toda navegação
- Mudanças de rota não recarregam a página
- Estado é mantido entre navegações

```typescript
// App.tsx - Configuração de rotas
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/live/:id" element={<LiveViewer />} />
        {/* Rotas protegidas */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}
```

---

## 4. Padrões de Design

### Component Composition Pattern

Composição de componentes menores para formar interfaces complexas:

```typescript
// Componentes pequenos e focados
<Card>
  <CardHeader>
    <CardTitle>Título</CardTitle>
    <CardDescription>Descrição</CardDescription>
  </CardHeader>
  <CardContent>
    <UserAvatar user={user} />
    <UserStats stats={stats} />
  </CardContent>
  <CardFooter>
    <Button>Ação</Button>
  </CardFooter>
</Card>
```

### Container/Presentational Pattern

Separação entre lógica e apresentação:

```typescript
// Container (lógica) - hook
function useLiveData(liveId: string) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchLive(liveId).then(setData).finally(() => setLoading(false));
  }, [liveId]);
  
  return { data, loading };
}

// Presentational (UI) - componente
function LiveCard({ data, loading }: LiveCardProps) {
  if (loading) return <Skeleton />;
  return (
    <Card>
      <img src={data.thumbnail} />
      <h3>{data.title}</h3>
    </Card>
  );
}

// Uso combinado
function LiveCardContainer({ liveId }: { liveId: string }) {
  const { data, loading } = useLiveData(liveId);
  return <LiveCard data={data} loading={loading} />;
}
```

### Provider Pattern (Context API)

Compartilhamento de estado sem prop drilling:

```typescript
// 1. Criar Context
const AuthContext = createContext<AuthContextType | null>(null);

// 2. Criar Provider
function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  
  const signIn = async (email: string, password: string) => {
    // lógica de login
  };
  
  return (
    <AuthContext.Provider value={{ user, signIn }}>
      {children}
    </AuthContext.Provider>
  );
}

// 3. Criar hook de consumo
function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

// 4. Usar na árvore
<AuthProvider>
  <App />
</AuthProvider>

// 5. Consumir em qualquer componente
function Profile() {
  const { user } = useAuth();
  return <p>Olá, {user.name}</p>;
}
```

### Render Props / Children as Function

Compartilhamento de lógica via função como children:

```typescript
function DataFetcher<T>({ 
  url, 
  children 
}: { 
  url: string; 
  children: (data: T, loading: boolean) => ReactNode 
}) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetch(url).then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, [url]);
  
  return <>{children(data, loading)}</>;
}

// Uso
<DataFetcher url="/api/users">
  {(users, loading) => 
    loading ? <Spinner /> : <UserList users={users} />
  }
</DataFetcher>
```

### Compound Components Pattern

Componentes que funcionam juntos compartilhando estado implícito:

```typescript
// Implementação
const TabsContext = createContext<TabsContextType>(null);

function Tabs({ children, defaultValue }) {
  const [activeTab, setActiveTab] = useState(defaultValue);
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </TabsContext.Provider>
  );
}

function TabsList({ children }) {
  return <div className="flex gap-2">{children}</div>;
}

function TabsTrigger({ value, children }) {
  const { activeTab, setActiveTab } = useContext(TabsContext);
  return (
    <button 
      onClick={() => setActiveTab(value)}
      className={activeTab === value ? 'active' : ''}
    >
      {children}
    </button>
  );
}

function TabsContent({ value, children }) {
  const { activeTab } = useContext(TabsContext);
  if (activeTab !== value) return null;
  return <div>{children}</div>;
}

// Uso
<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">Conteúdo 1</TabsContent>
  <TabsContent value="tab2">Conteúdo 2</TabsContent>
</Tabs>
```

---

## 5. Sistema de Design

### Conceito: Design Tokens

Design tokens são variáveis que armazenam valores de design (cores, espaçamentos, tipografia). Isso permite:
- Consistência visual
- Temas (dark/light mode)
- Manutenção centralizada

### CSS Custom Properties (Variáveis CSS)

```css
/* src/index.css */
:root {
  /* Cores em HSL (Hue, Saturation, Lightness) */
  --background: 0 0% 0%;           /* hsl(0, 0%, 0%) = preto */
  --foreground: 0 0% 100%;         /* hsl(0, 0%, 100%) = branco */
  
  --primary: 270 70% 55%;          /* Roxo */
  --primary-foreground: 0 0% 100%;
  
  --secondary: 270 50% 45%;
  --destructive: 0 84% 70%;        /* Vermelho */
  --success: 142 76% 50%;          /* Verde */
  
  /* Componentes UI */
  --border: 0 0% 25%;
  --input: 0 0% 20%;
  --ring: 270 70% 60%;             /* Cor de foco */
  
  --radius: 0.75rem;               /* Border radius padrão */
}
```

### Integração com Tailwind CSS

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        // Mapeia CSS variables para classes Tailwind
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        // ...
      },
    },
  },
};
```

### Utility-First CSS (Tailwind)

Tailwind usa classes utilitárias ao invés de CSS semântico:

```tsx
// ❌ CSS tradicional
<div className="card">
  <h1 className="card-title">Título</h1>
</div>

// styles.css
.card { padding: 16px; border-radius: 8px; background: white; }
.card-title { font-size: 24px; font-weight: bold; }

// ✅ Tailwind utility-first
<div className="p-4 rounded-lg bg-card">
  <h1 className="text-2xl font-bold text-foreground">Título</h1>
</div>
```

### Class Variance Authority (CVA)

Gerencia variantes de componentes de forma tipada:

```typescript
// src/components/ui/button.tsx
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  // Classes base (sempre aplicadas)
  "inline-flex items-center justify-center rounded-md font-medium transition-colors",
  {
    variants: {
      // Variante: variant
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground",
        outline: "border border-input bg-background hover:bg-accent",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
      // Variante: size
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

interface ButtonProps extends VariantProps<typeof buttonVariants> {
  children: ReactNode;
}

function Button({ variant, size, children }: ButtonProps) {
  return (
    <button className={buttonVariants({ variant, size })}>
      {children}
    </button>
  );
}

// Uso
<Button variant="destructive" size="lg">Deletar</Button>
```

### Função cn() - Class Name Merge

Combina classes condicionalmente e resolve conflitos:

```typescript
// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Uso
cn("px-4 py-2", condition && "bg-primary", "px-6") 
// Resultado: "py-2 px-6 bg-primary"
// twMerge resolve conflito px-4 vs px-6
```

---

## 6. Internacionalização (i18n)

### Conceito

Internacionalização (i18n) é o processo de preparar uma aplicação para suportar múltiplos idiomas e regiões. O "18" representa as 18 letras entre "i" e "n" na palavra "internationalization".

### Arquitetura do Sistema de Traduções

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SISTEMA DE INTERNACIONALIZAÇÃO                        │
│                                                                              │
│   ┌───────────────────────────────────────────────────────────────────────┐ │
│   │                     src/lib/i18n.ts                                    │ │
│   │                  (Arquivo de Traduções)                                │ │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │ │
│   │  │     EN      │  │     ES      │  │     PT      │                   │ │
│   │  │  (Inglês)   │  │ (Espanhol)  │  │ (Português) │                   │ │
│   │  └─────────────┘  └─────────────┘  └─────────────┘                   │ │
│   └───────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│                                    ▼                                         │
│   ┌───────────────────────────────────────────────────────────────────────┐ │
│   │               src/hooks/useLanguage.tsx                                │ │
│   │                  (LanguageProvider)                                    │ │
│   │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│   │  │ • useState para idioma atual                                    │  │ │
│   │  │ • localStorage para persistência                                │  │ │
│   │  │ • Detecção automática do navegador                              │  │ │
│   │  │ • Context API para distribuição                                 │  │ │
│   │  └─────────────────────────────────────────────────────────────────┘  │ │
│   └───────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│                                    ▼                                         │
│   ┌───────────────────────────────────────────────────────────────────────┐ │
│   │              src/components/LanguageSelector.tsx                       │ │
│   │                  (Componente de Seleção)                               │ │
│   │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│   │  │ 🇺🇸 EN │ 🇪🇸 ES │ 🇧🇷 PT │  ← Dropdown com bandeiras            │  │ │
│   │  └─────────────────────────────────────────────────────────────────┘  │ │
│   └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Estrutura do Arquivo de Traduções

```typescript
// src/lib/i18n.ts

// Tipo que define idiomas suportados
export type Language = 'en' | 'es' | 'pt';

// Objeto com todas as traduções organizadas por namespace
export const translations = {
  en: {
    nav: {
      dashboard: "Dashboard",
      logout: "Logout",
      login: "Login",
      profile: "Profile",
      home: "Home",
    },
    auth: {
      email: "Email",
      password: "Password",
      loginButton: "Sign In",
      loading: "Loading...",
    },
    home: {
      title: "Stream Star",
      onlineNow: "Online Now",
      search: "Search creators...",
      noCreators: "No creators found",
    },
    // ... outros namespaces
  },
  
  es: {
    nav: {
      dashboard: "Panel de Control",
      logout: "Cerrar Sesión",
      login: "Iniciar Sesión",
      profile: "Perfil",
      home: "Inicio",
    },
    // ... mesma estrutura que EN
  },
  
  pt: {
    nav: {
      dashboard: "Painel",
      logout: "Sair",
      login: "Entrar",
      profile: "Perfil",
      home: "Início",
    },
    // ... mesma estrutura que EN
  },
};
```

### Provider Pattern para Idioma

```typescript
// src/hooks/useLanguage.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translations, Language } from '@/lib/i18n';

// 1. Definir tipo do contexto
interface LanguageContextType {
  language: Language;             // Idioma atual
  setLanguage: (lang: Language) => void;  // Função para mudar idioma
  t: typeof translations.en;      // Objeto de traduções do idioma atual
}

// 2. Criar contexto
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// 3. Criar Provider
export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  // Estado inicial: tenta carregar do localStorage ou detecta do navegador
  const [language, setLanguageState] = useState<Language>(() => {
    // Primeiro: verifica se há idioma salvo
    const saved = localStorage.getItem('language');
    if (saved && (saved === 'en' || saved === 'es' || saved === 'pt')) {
      return saved as Language;
    }
    
    // Segundo: detecta idioma do navegador
    const browserLang = navigator.language.split('-')[0];
    if (browserLang === 'es' || browserLang === 'pt') {
      return browserLang as Language;
    }
    
    // Fallback: inglês
    return 'en';
  });

  // Função para mudar idioma e persistir
  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);  // Persiste a escolha
  };

  // Objeto de traduções do idioma atual
  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

// 4. Hook customizado para consumir o contexto
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};
```

### Componente de Seleção de Idioma

```typescript
// src/components/LanguageSelector.tsx
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Check } from 'lucide-react';

// Array de idiomas disponíveis com suas bandeiras
const LANGUAGES = [
  { code: 'en', label: 'EN', flag: '/flags/us.png' },
  { code: 'es', label: 'ES', flag: '/flags/es.png' },
  { code: 'pt', label: 'PT', flag: '/flags/br.png' },
];

export const LanguageSelector = () => {
  const { language, setLanguage } = useLanguage();
  
  // Encontra dados do idioma atual para exibir
  const currentLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[2];

  return (
    <DropdownMenu>
      {/* Botão que mostra bandeira atual */}
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <img 
            src={currentLang.flag} 
            alt={currentLang.label} 
            className="w-6 h-4 object-cover rounded-sm"
          />
        </Button>
      </DropdownMenuTrigger>
      
      {/* Menu dropdown com opções */}
      <DropdownMenuContent align="end">
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code as Language)}
            className={language === lang.code ? 'bg-primary/20' : ''}
          >
            {/* Check mark no idioma selecionado */}
            {language === lang.code && <Check className="h-4 w-4 text-primary" />}
            <img src={lang.flag} alt={lang.label} className="w-5 h-3.5" />
            <span>{lang.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
```

### Uso nos Componentes

```typescript
// Qualquer componente pode usar traduções via hook
import { useLanguage } from '@/hooks/useLanguage';

function LoginForm() {
  const { t } = useLanguage();  // Obtém traduções do idioma atual
  
  return (
    <form>
      {/* Textos vêm do objeto de traduções */}
      <label>{t.auth.email}</label>
      <Input placeholder={t.auth.email} />
      
      <label>{t.auth.password}</label>
      <Input type="password" />
      
      <Button>{t.auth.loginButton}</Button>
    </form>
  );
}

// O texto muda automaticamente quando o idioma é alterado!
// Se language = 'pt': "Email", "Senha", "Entrar"
// Se language = 'en': "Email", "Password", "Sign In"
// Se language = 'es': "Correo", "Contraseña", "Iniciar Sesión"
```

### Interpolação de Variáveis

Para textos dinâmicos com variáveis:

```typescript
// Na definição das traduções
const translations = {
  pt: {
    chat: {
      isTyping: "{name} está digitando...",
      areTyping: "{names} estão digitando...",
      multipleTyping: "{count} pessoas estão digitando...",
    },
  },
};

// No componente - substituição manual
function TypingIndicator({ usernames }: { usernames: string[] }) {
  const { t } = useLanguage();
  
  const getTypingText = () => {
    if (usernames.length === 1) {
      // Substitui placeholder pela variável
      return t.chat.isTyping.replace("{name}", usernames[0]);
      // Resultado: "João está digitando..."
    }
    if (usernames.length === 2) {
      return t.chat.areTyping.replace("{names}", usernames.join(" e "));
      // Resultado: "João e Maria estão digitando..."
    }
    return t.chat.multipleTyping.replace("{count}", String(usernames.length));
    // Resultado: "5 pessoas estão digitando..."
  };
  
  return <span>{getTypingText()}</span>;
}
```

### Fallback Seguro

Para evitar erros quando uma tradução não existe:

```typescript
// Acesso seguro com optional chaining e fallback
const getTypingText = () => {
  if (usernames.length === 1) {
    // Se t.chat?.isTyping não existir, usa fallback
    return t.chat?.isTyping 
      ? t.chat.isTyping.replace("{name}", usernames[0])
      : `${usernames[0]} está digitando...`;  // Fallback hardcoded
  }
  // ...
};
```

### Fluxo Completo de Internacionalização

```
                    ┌─────────────────────────────────────────┐
                    │            INICIALIZAÇÃO                │
                    └─────────────────────────────────────────┘
                                        │
                                        ▼
                    ┌─────────────────────────────────────────┐
                    │     localStorage.getItem('language')     │
                    │               tem valor?                 │
                    └─────────────────────────────────────────┘
                               │              │
                           SIM ▼              ▼ NÃO
                    ┌──────────────┐   ┌──────────────────────┐
                    │  Usa idioma  │   │ navigator.language   │
                    │    salvo     │   │   é pt ou es?        │
                    └──────────────┘   └──────────────────────┘
                           │                  │          │
                           │              SIM ▼          ▼ NÃO
                           │          ┌──────────┐  ┌──────────┐
                           │          │ Usa esse │  │ Usa 'en' │
                           │          │  idioma  │  │(fallback)│
                           │          └──────────┘  └──────────┘
                           │                │          │
                           └────────────────┴──────────┘
                                        │
                                        ▼
                    ┌─────────────────────────────────────────┐
                    │   useState(language) inicializado       │
                    │   t = translations[language]            │
                    └─────────────────────────────────────────┘
                                        │
                                        ▼
                    ┌─────────────────────────────────────────┐
                    │      Componentes usam {t.xxx.yyy}       │
                    │       para exibir textos traduzidos     │
                    └─────────────────────────────────────────┘
                                        │
                                        ▼
                    ┌─────────────────────────────────────────┐
                    │  Usuário clica em outro idioma no       │
                    │        LanguageSelector                 │
                    └─────────────────────────────────────────┘
                                        │
                                        ▼
                    ┌─────────────────────────────────────────┐
                    │    setLanguage('es')                    │
                    │    • Atualiza state                     │
                    │    • localStorage.setItem('language')   │
                    │    • t = translations['es']             │
                    └─────────────────────────────────────────┘
                                        │
                                        ▼
                    ┌─────────────────────────────────────────┐
                    │    React re-renderiza componentes       │
                    │    com novas traduções automaticamente  │
                    └─────────────────────────────────────────┘
```

### Namespaces de Tradução

O arquivo i18n.ts organiza traduções em namespaces por funcionalidade:

| Namespace | Propósito |
|-----------|-----------|
| `nav` | Navegação, navbar, links |
| `auth` | Login, registro, senhas |
| `home` | Página inicial |
| `dashboard` | Dashboard do usuário |
| `profile` | Perfil e configurações |
| `credits` | Sistema de créditos |
| `admin` | Painel administrativo |
| `affiliate` | Sistema de afiliados |
| `common` | Textos genéricos reutilizáveis |
| `chat` | Mensagens e chat |
| `notifications` | Notificações |
| `subscribe` | Página de assinatura |

### Testes com Mock de Idioma

```typescript
// src/test/setup.ts
vi.mock("@/hooks/useLanguage", () => {
  const translations = {
    auth: {
      email: "Email",
      password: "Senha",
      loginButton: "Entrar",
    },
    // ... traduções necessárias para testes
  };

  return {
    useLanguage: () => ({ 
      language: "pt", 
      setLanguage: vi.fn(), 
      t: translations 
    }),
    LanguageProvider: ({ children }) => children,
  };
});
```

---

## 7. Banco de Dados Relacional

### PostgreSQL

PostgreSQL é um banco de dados relacional open-source com suporte a:
- ACID (Atomicity, Consistency, Isolation, Durability)
- JSON/JSONB nativo
- Full-text search
- Extensões (PostGIS, pgvector, etc.)

### Modelo Relacional

```
┌──────────────────┐       ┌──────────────────┐
│     profiles     │       │      lives       │
├──────────────────┤       ├──────────────────┤
│ id (PK, UUID)    │───┐   │ id (PK, UUID)    │
│ username         │   │   │ creator_id (FK)  │──┐
│ email            │   │   │ title            │  │
│ avatar_url       │   │   │ status           │  │
│ is_subscribed    │   │   │ is_active        │  │
│ referral_code    │   └───│ created_at       │  │
│ referred_by      │       └──────────────────┘  │
└──────────────────┘                             │
                                                 │
┌──────────────────┐       ┌──────────────────┐  │
│ creator_profiles │       │ live_consumption │  │
├──────────────────┤       ├──────────────────┤  │
│ id (PK, FK)      │───────│ id (PK, UUID)    │  │
│ display_name     │       │ live_id (FK)     │──┘
│ bio              │       │ user_id (FK)     │
│ is_streaming     │       │ credits_consumed │
│ tags             │       │ seconds_watched  │
└──────────────────┘       └──────────────────┘
```

### Row Level Security (RLS)

RLS permite definir políticas de acesso por linha:

```sql
-- Habilitar RLS na tabela
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Política: usuários podem ver todos os perfis
CREATE POLICY "Profiles are viewable by everyone" 
ON profiles FOR SELECT 
USING (true);

-- Política: usuários só podem editar seu próprio perfil
CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE 
USING (auth.uid() = id);

-- Política: apenas criador pode ver seus ganhos
CREATE POLICY "Creators can view own earnings" 
ON creator_earnings FOR SELECT 
USING (auth.uid() = creator_id);
```

### Queries com Supabase Client

```typescript
import { supabase } from "@/integrations/supabase/client";

// SELECT com filtros
const { data, error } = await supabase
  .from('lives')
  .select('id, title, creator_id, status')
  .eq('status', 'live')
  .order('created_at', { ascending: false })
  .limit(10);

// SELECT com JOIN (foreign key)
const { data } = await supabase
  .from('lives')
  .select(`
    id,
    title,
    creator_profiles (
      display_name,
      avatar_url
    )
  `)
  .eq('is_active', true);

// INSERT
const { data, error } = await supabase
  .from('messages')
  .insert({
    room_id: roomId,
    user_id: userId,
    content: 'Hello!'
  })
  .select()
  .single();

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

// UPSERT (insert or update)
const { error } = await supabase
  .from('user_preferences')
  .upsert({ user_id: id, theme: 'dark' });
```

### Tipos TypeScript Gerados

Os tipos do banco são gerados automaticamente:

```typescript
// src/integrations/supabase/types.ts (auto-gerado)
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          email: string;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          email?: string;
          // ...
        };
        Update: {
          username?: string;
          avatar_url?: string;
          // ...
        };
      };
      // outras tabelas...
    };
  };
}
```

---

## 8. Autenticação e Autorização

### Fluxo de Autenticação JWT

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Cliente   │───▶│  Supabase   │───▶│  PostgreSQL │
│  (Browser)  │    │    Auth     │    │   (Users)   │
└─────────────┘    └─────────────┘    └─────────────┘
      │                   │
      │    JWT Token      │
      │◀──────────────────│
      │                   │
      ▼                   │
┌─────────────┐          │
│ localStorage │          │
│  (Session)  │          │
└─────────────┘          │
```

### JSON Web Token (JWT)

JWT é um padrão para transmissão segura de informações:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.  <- Header (algoritmo)
eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6.  <- Payload (dados)
SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_   <- Signature (assinatura)
```

**Payload típico:**
```json
{
  "sub": "user-uuid-123",
  "email": "user@email.com",
  "role": "authenticated",
  "exp": 1699999999
}
```

### Implementação do AuthContext

```typescript
// src/contexts/AuthContext.tsx
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Listener para mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Eventos: SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, etc.
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    // 2. Verificar sessão existente (cookie/localStorage)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`
      }
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
}
```

### Protected Routes

Padrão para proteger rotas que requerem autenticação:

```typescript
// src/components/ProtectedRoute.tsx
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <PageLoading />;
  }

  if (!user) {
    // Redireciona para login, salvando origem
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

// Uso no router
<Route 
  path="/dashboard" 
  element={
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  } 
/>
```

### Role-Based Access Control (RBAC)

```typescript
// Verificar role do usuário
async function checkUserRole(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);
  
  return data?.map(r => r.role) ?? [];
}

// Componente que verifica role
function AdminRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (user) {
      checkUserRole(user.id).then(roles => {
        setIsAdmin(roles.includes('admin'));
        setChecking(false);
      });
    }
  }, [user]);

  if (checking) return <Loading />;
  if (!isAdmin) return <Navigate to="/access-denied" />;
  
  return <>{children}</>;
}
```

---

## 9. Protocolo WebRTC e Streaming

### O que é WebRTC?

WebRTC (Web Real-Time Communication) é um protocolo para comunicação peer-to-peer de áudio, vídeo e dados diretamente no navegador.

### Componentes do WebRTC

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         WebRTC Stack                                     │
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │   MediaStream   │  │ RTCPeerConnection│  │  RTCDataChannel │         │
│  │  (Áudio/Vídeo)  │  │   (Conexão P2P)  │  │     (Dados)     │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│           │                    │                    │                    │
│           └────────────────────┼────────────────────┘                    │
│                                │                                         │
│  ┌─────────────────────────────┼─────────────────────────────────────┐  │
│  │                       Protocolos                                   │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │  │
│  │  │   ICE    │  │   STUN   │  │   TURN   │  │   DTLS   │          │  │
│  │  │(NAT Trav)│  │(Discovery)│ │ (Relay)  │  │(Security)│          │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘          │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### SFU (Selective Forwarding Unit) - LiveKit

Em vez de P2P direto, usamos um servidor SFU para escalabilidade:

```
       ┌─────────────────────────────────────┐
       │           LiveKit Server            │
       │              (SFU)                  │
       └─────────────────────────────────────┘
              ▲           │           │
              │           │           │
              │           ▼           ▼
       ┌──────────┐  ┌──────────┐  ┌──────────┐
       │ Publisher │  │ Viewer 1 │  │ Viewer 2 │
       │ (Criador) │  │          │  │          │
       └──────────┘  └──────────┘  └──────────┘

Publisher envia 1 stream → SFU distribui para N viewers
```

### Fluxo de Conexão WebRTC

```typescript
// 1. Obter acesso à câmera/microfone
const stream = await navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
});

// 2. Conectar ao LiveKit (que abstrai WebRTC)
import { Room, RoomEvent } from 'livekit-client';

const room = new Room();

// 3. Eventos de conexão
room.on(RoomEvent.Connected, () => {
  console.log('Conectado à sala');
});

room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
  // Novo track de vídeo/áudio disponível
  if (track.kind === 'video') {
    const element = track.attach();
    videoContainer.appendChild(element);
  }
});

// 4. Conectar com token JWT
await room.connect(LIVEKIT_URL, accessToken);

// 5. Publicar mídia local (criador)
await room.localParticipant.setCameraEnabled(true);
await room.localParticipant.setMicrophoneEnabled(true);
```

### Edge Function para Token LiveKit

```typescript
// supabase/functions/livekit-room/index.ts
import { AccessToken } from 'livekit-server-sdk';

Deno.serve(async (req) => {
  const { roomName, identity, isPublisher } = await req.json();
  
  const token = new AccessToken(
    Deno.env.get('LIVEKIT_API_KEY'),
    Deno.env.get('LIVEKIT_API_SECRET'),
    { identity }
  );
  
  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: isPublisher,
    canSubscribe: true
  });
  
  return new Response(
    JSON.stringify({ token: token.toJwt() }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
```

---

## 10. Comunicação em Tempo Real

### Supabase Realtime (WebSocket)

Supabase Realtime permite escutar mudanças no banco via WebSocket:

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Browser   │◀───────▶│  Realtime   │◀───────▶│  PostgreSQL │
│  (Client)   │   WS    │   Server    │  NOTIFY │   (DB)      │
└─────────────┘         └─────────────┘         └─────────────┘
```

### Postgres Changes

Escutar INSERT, UPDATE, DELETE em tabelas:

```typescript
import { supabase } from '@/integrations/supabase/client';

// Escutar todas as mudanças na tabela messages
const channel = supabase
  .channel('room-messages')
  .on(
    'postgres_changes',
    {
      event: '*',        // INSERT, UPDATE, DELETE, ou *
      schema: 'public',
      table: 'messages',
      filter: `room_id=eq.${roomId}`  // Filtro opcional
    },
    (payload) => {
      console.log('Mudança:', payload);
      // payload.eventType: 'INSERT' | 'UPDATE' | 'DELETE'
      // payload.new: novo registro
      // payload.old: registro anterior (UPDATE/DELETE)
      
      if (payload.eventType === 'INSERT') {
        setMessages(prev => [...prev, payload.new]);
      }
    }
  )
  .subscribe();

// Cleanup
return () => {
  supabase.removeChannel(channel);
};
```

### Broadcast (Presença e Eventos)

Comunicação client-to-client sem passar pelo banco:

```typescript
// Broadcast: eventos efêmeros
const channel = supabase.channel('live-room');

// Enviar evento
channel.send({
  type: 'broadcast',
  event: 'typing',
  payload: { userId, username }
});

// Receber evento
channel.on('broadcast', { event: 'typing' }, ({ payload }) => {
  console.log(`${payload.username} está digitando...`);
});

// Presence: quem está online
channel.on('presence', { event: 'sync' }, () => {
  const state = channel.presenceState();
  console.log('Online:', Object.keys(state).length);
});

// Anunciar presença
channel.subscribe(async (status) => {
  if (status === 'SUBSCRIBED') {
    await channel.track({ user_id: userId, online_at: new Date() });
  }
});
```

### Implementação de Chat em Tempo Real

```typescript
function useRealtimeChat(roomId: string) {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    // 1. Carregar mensagens existentes
    supabase
      .from('messages')
      .select('*, profiles(username, avatar_url)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .then(({ data }) => setMessages(data || []));

    // 2. Escutar novas mensagens
    const channel = supabase
      .channel(`chat-${roomId}`)
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        async (payload) => {
          // Buscar dados do perfil
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', payload.new.user_id)
            .single();
          
          const newMessage = { ...payload.new, profiles: profile };
          setMessages(prev => [...prev, newMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const sendMessage = async (content: string, userId: string) => {
    await supabase.from('messages').insert({
      room_id: roomId,
      user_id: userId,
      content
    });
  };

  return { messages, sendMessage };
}
```

---

## 11. Serverless Functions

### Edge Functions (Deno Runtime)

Edge Functions são funções serverless que rodam próximo ao usuário (edge computing):

**Características:**
- Runtime: Deno (TypeScript nativo)
- Cold start rápido
- Isolamento por requisição
- Acesso a secrets via `Deno.env`

### Estrutura de uma Edge Function

```typescript
// supabase/functions/minha-funcao/index.ts

// Importações Deno
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Headers CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Handler principal
serve(async (req: Request) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Criar cliente Supabase com service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Obter usuário autenticado do token
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      );
    }

    // Processar body
    const { param1, param2 } = await req.json();

    // Lógica de negócio
    const result = await processarDados(param1, param2);

    // Retornar resposta
    return new Response(
      JSON.stringify({ success: true, data: result }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
```

### Chamando Edge Functions do Frontend

```typescript
import { supabase } from '@/integrations/supabase/client';

// Método 1: supabase.functions.invoke
const { data, error } = await supabase.functions.invoke('minha-funcao', {
  body: { param1: 'valor1', param2: 'valor2' }
});

// Método 2: fetch direto
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/minha-funcao`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ param1: 'valor1' })
  }
);
const data = await response.json();
```

### Secrets e Variáveis de Ambiente

```typescript
// Acessar secrets na Edge Function
const apiKey = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
const livekitKey = Deno.env.get('LIVEKIT_API_KEY');

// Variáveis automáticas disponíveis:
// - SUPABASE_URL
// - SUPABASE_ANON_KEY
// - SUPABASE_SERVICE_ROLE_KEY
```

---

## 12. Webhooks e Integrações

### O que é um Webhook?

Webhook é um padrão de comunicação onde um serviço externo envia dados para sua aplicação quando um evento ocorre:

```
┌─────────────────┐    Evento ocorre    ┌─────────────────┐
│  Mercado Pago   │ ─────────────────▶  │  Edge Function  │
│   (Pagamento)   │    POST /webhook    │ (Processa dados)│
└─────────────────┘                     └─────────────────┘
                                               │
                                               ▼
                                        ┌─────────────────┐
                                        │    Database     │
                                        │ (Atualiza dados)│
                                        └─────────────────┘
```

### Implementação de Webhook

```typescript
// supabase/functions/mercadopago-webhook/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.168.0/crypto/mod.ts';

serve(async (req) => {
  // 1. Validar assinatura do webhook
  const signature = req.headers.get('x-signature');
  const body = await req.text();
  
  const expectedSignature = createHmac('sha256', WEBHOOK_SECRET)
    .update(body)
    .digest('hex');
  
  if (signature !== expectedSignature) {
    return new Response('Invalid signature', { status: 401 });
  }

  // 2. Parsear payload
  const payload = JSON.parse(body);

  // 3. Idempotência - evitar processar evento duplicado
  const { data: existing } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('idempotency_key', payload.id)
    .single();

  if (existing) {
    return new Response('Already processed', { status: 200 });
  }

  // 4. Processar evento
  if (payload.action === 'payment.updated') {
    await processPaymentUpdate(payload);
  }

  // 5. Registrar evento como processado
  await supabase.from('webhook_events').insert({
    idempotency_key: payload.id,
    processed_at: new Date().toISOString()
  });

  return new Response('OK', { status: 200 });
});
```

### Padrão de Retry e Logging

```typescript
// Logging de webhooks para debug
await supabase.from('webhook_logs').insert({
  source: 'mercadopago',
  event_type: payload.action,
  payload: payload,
  status: 'received'
});

try {
  await processWebhook(payload);
  
  await supabase.from('webhook_logs')
    .update({ status: 'processed', processed_at: new Date() })
    .eq('id', logId);
    
} catch (error) {
  await supabase.from('webhook_logs')
    .update({ status: 'failed', error_message: error.message })
    .eq('id', logId);
  
  // Retornar erro para webhook tentar novamente
  throw error;
}
```

---

## 13. Fluxos de Dados

### Fluxo: Compra de Créditos

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 1. INICIAÇÃO                                                              │
│    Usuário clica "Comprar Créditos"                                       │
│    ↓                                                                      │
│    Frontend chama Edge Function: create-payment                           │
│    ↓                                                                      │
│    Edge Function cria pagamento no Mercado Pago                           │
│    ↓                                                                      │
│    Retorna URL de checkout ou QR Code PIX                                 │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 2. PAGAMENTO                                                              │
│    Usuário completa pagamento no Mercado Pago                             │
│    ↓                                                                      │
│    Mercado Pago envia webhook para: mercadopago-webhook                   │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 3. PROCESSAMENTO                                                          │
│    Edge Function valida assinatura do webhook                             │
│    ↓                                                                      │
│    Busca detalhes do pagamento na API Mercado Pago                        │
│    ↓                                                                      │
│    Se status === 'approved':                                              │
│      - UPDATE credits_wallet (adiciona créditos)                          │
│      - INSERT credit_purchases (registro)                                 │
│      - INSERT platform_revenue (receita)                                  │
│      - Se tem afiliado: calcula e credita comissões                       │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 4. ATUALIZAÇÃO EM TEMPO REAL                                              │
│    Frontend escuta changes em credits_wallet via Realtime                 │
│    ↓                                                                      │
│    UI atualiza saldo automaticamente                                      │
│    ↓                                                                      │
│    Toast de confirmação                                                   │
└──────────────────────────────────────────────────────────────────────────┘
```

### Fluxo: Assistir Live (Consumo de Créditos)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 1. CONEXÃO                                                                │
│    Viewer acessa /live/:id                                                │
│    ↓                                                                      │
│    Verifica se tem créditos suficientes                                   │
│    ↓                                                                      │
│    Solicita token LiveKit via Edge Function                               │
│    ↓                                                                      │
│    Conecta ao LiveKit e recebe stream                                     │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 2. HEARTBEAT (a cada 5 segundos)                                          │
│    Frontend envia heartbeat para: viewer-heartbeat                        │
│    ↓                                                                      │
│    Edge Function verifica:                                                │
│      - Live ainda ativa?                                                  │
│      - Passou 1 minuto desde último débito?                               │
│    ↓                                                                      │
│    Se passou 1 minuto:                                                    │
│      - Debita 1 crédito do viewer                                         │
│      - Credita % para criador                                             │
│      - Credita % para afiliado (se houver)                                │
│      - Registra em live_consumption                                       │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 3. CRÉDITOS ESGOTADOS                                                     │
│    credits_wallet.balance_credits === 0                                   │
│    ↓                                                                      │
│    Frontend detecta via Realtime                                          │
│    ↓                                                                      │
│    Exibe PaywallOverlay                                                   │
│    ↓                                                                      │
│    Usuário pode: Comprar mais créditos | Sair da live                     │
└──────────────────────────────────────────────────────────────────────────┘
```

### Fluxo: Criador Faz Live

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 1. PREPARAÇÃO                                                             │
│    Criador acessa /creator-room                                           │
│    ↓                                                                      │
│    Define título e thumbnail                                              │
│    ↓                                                                      │
│    INSERT lives (status: 'waiting')                                       │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 2. INÍCIO DA TRANSMISSÃO                                                  │
│    Solicita permissão de câmera/microfone                                 │
│    ↓                                                                      │
│    Solicita token LiveKit (isPublisher: true)                             │
│    ↓                                                                      │
│    Conecta ao LiveKit e publica mídia                                     │
│    ↓                                                                      │
│    UPDATE lives (status: 'live', host_joined_at: now())                   │
│    ↓                                                                      │
│    Inicia heartbeat do host (manter live ativa)                           │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 3. DURANTE A LIVE                                                         │
│    Chat em tempo real (Supabase Realtime)                                 │
│    ↓                                                                      │
│    SuperChats recebidos (exibidos na fila)                                │
│    ↓                                                                      │
│    Viewers entram e saem                                                  │
│    ↓                                                                      │
│    Monitor de lives atualiza contadores                                   │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 4. ENCERRAMENTO                                                           │
│    Criador clica "Encerrar"                                               │
│    ↓                                                                      │
│    Desconecta do LiveKit                                                  │
│    ↓                                                                      │
│    UPDATE lives (status: 'ended', ended_at: now())                        │
│    ↓                                                                      │
│    Calcula e registra creator_earnings                                    │
│    ↓                                                                      │
│    Credita creator_wallet                                                 │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 14. Gerenciamento de Estado

### Níveis de Estado

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          ESTADO DO SERVIDOR                              │
│    PostgreSQL (Supabase) - Fonte da verdade                              │
│    - Dados persistentes                                                  │
│    - Sincronização via Realtime                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          ESTADO GLOBAL (CLIENT)                          │
│    React Context - Estado compartilhado entre rotas                      │
│    - AuthContext (user, session)                                         │
│    - CreditsContext (saldo de créditos)                                  │
│    - SidebarContext (UI state)                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          CACHE DE DADOS                                  │
│    TanStack Query - Cache e sincronização                                │
│    - Queries cacheadas                                                   │
│    - Invalidação automática                                              │
│    - Refetch em foco/reconexão                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          ESTADO LOCAL                                    │
│    useState/useReducer - Estado de componente                            │
│    - Formulários                                                         │
│    - UI toggles                                                          │
│    - Estado temporário                                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### TanStack Query (React Query)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Query: buscar dados
function useLives() {
  return useQuery({
    queryKey: ['lives', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lives')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60, // Dados "frescos" por 1 minuto
    refetchOnWindowFocus: true,
  });
}

// Mutation: modificar dados
function useCreateLive() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (liveData: CreateLiveData) => {
      const { data, error } = await supabase
        .from('lives')
        .insert(liveData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidar cache para refetch
      queryClient.invalidateQueries({ queryKey: ['lives'] });
    },
  });
}

// Uso no componente
function LivesPage() {
  const { data: lives, isLoading, error } = useLives();
  const createLive = useCreateLive();

  if (isLoading) return <Loading />;
  if (error) return <Error message={error.message} />;

  return (
    <div>
      {lives.map(live => <LiveCard key={live.id} live={live} />)}
      <button onClick={() => createLive.mutate({ title: 'Nova Live' })}>
        Criar Live
      </button>
    </div>
  );
}
```

### Sincronização Realtime + Query

```typescript
function useLivesWithRealtime() {
  const queryClient = useQueryClient();
  
  // Query inicial
  const query = useQuery({
    queryKey: ['lives'],
    queryFn: fetchLives,
  });

  // Sincronização em tempo real
  useEffect(() => {
    const channel = supabase
      .channel('lives-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'lives' },
        () => {
          // Invalidar cache quando houver mudanças
          queryClient.invalidateQueries({ queryKey: ['lives'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}
```

---

## 15. Padrões de Código

### Estrutura de Componente

```typescript
// src/components/MeuComponente.tsx

// 1. Imports (organizados por tipo)
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

// 2. Types/Interfaces
type Profile = Database['public']['Tables']['profiles']['Row'];

interface MeuComponenteProps {
  userId: string;
  onSuccess?: (data: Profile) => void;
}

// 3. Componente
export function MeuComponente({ userId, onSuccess }: MeuComponenteProps) {
  // 3a. Hooks (ordem consistente)
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Profile | null>(null);

  // 3b. Effects
  useEffect(() => {
    fetchData();
  }, [userId]);

  // 3c. Handlers e funções
  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      setData(data);
    }
    setLoading(false);
  }, [userId, toast]);

  const handleSubmit = async () => {
    // lógica
    onSuccess?.(data!);
  };

  // 3d. Early returns
  if (loading) return <div className="animate-pulse">Carregando...</div>;
  if (!data) return null;

  // 3e. Render principal
  return (
    <div className="p-4 bg-card rounded-lg border border-border">
      <h2 className="text-lg font-semibold text-foreground">{data.username}</h2>
      <p className="text-muted-foreground">{data.bio}</p>
      <Button onClick={handleSubmit}>Salvar</Button>
    </div>
  );
}
```

### Custom Hook

```typescript
// src/hooks/useMeuHook.ts

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseMeuHookOptions {
  enabled?: boolean;
  onError?: (error: Error) => void;
}

interface UseMeuHookResult<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useMeuHook<T>(
  tableName: string,
  options: UseMeuHookOptions = {}
): UseMeuHookResult<T> {
  const { enabled = true, onError } = options;
  
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*');

      if (error) throw error;
      setData(data as T[]);
    } catch (err) {
      const error = err as Error;
      setError(error);
      onError?.(error);
    } finally {
      setLoading(false);
    }
  }, [tableName, enabled, onError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
```

### Service Layer

```typescript
// src/lib/livesService.ts

import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Live = Database['public']['Tables']['lives']['Row'];
type CreateLiveInput = Database['public']['Tables']['lives']['Insert'];

export async function getLives(filters?: { status?: string; creatorId?: string }) {
  let query = supabase
    .from('lives')
    .select(`
      *,
      creator_profiles (
        display_name,
        avatar_url
      )
    `)
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.creatorId) {
    query = query.eq('creator_id', filters.creatorId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createLive(input: CreateLiveInput): Promise<Live> {
  const { data, error } = await supabase
    .from('lives')
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateLiveStatus(liveId: string, status: string) {
  const updates: Partial<Live> = { status };
  
  if (status === 'ended') {
    updates.ended_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('lives')
    .update(updates)
    .eq('id', liveId);

  if (error) throw error;
}
```

### Convenções de Nomenclatura

| Tipo | Convenção | Exemplo |
|------|-----------|---------|
| Componentes | PascalCase | `LiveViewer.tsx`, `UserCard.tsx` |
| Hooks | camelCase com "use" | `useLiveData.ts`, `useAuth.ts` |
| Serviços | camelCase + "Service" | `livesService.ts` |
| Utilitários | camelCase | `formatDate.ts`, `cn.ts` |
| Types/Interfaces | PascalCase | `UserProfile`, `LiveData` |
| Constantes | UPPER_SNAKE_CASE | `API_BASE_URL`, `MAX_RETRIES` |
| Funções | camelCase (verbos) | `fetchLives()`, `calculateTotal()` |
| Eventos | handle + Ação | `handleClick`, `handleSubmit` |
| Booleanos | is/has/can/should | `isLoading`, `hasError`, `canEdit` |

---

## 📎 Referência Rápida

### Comandos Úteis

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev

# Build para produção
npm run build

# Rodar testes
npm test
```

### Arquivos Mais Importantes

| Arquivo | Propósito |
|---------|-----------|
| `src/App.tsx` | Rotas e estrutura principal |
| `src/index.css` | Design tokens (cores, fontes) |
| `src/contexts/AuthContext.tsx` | Lógica de autenticação |
| `src/lib/i18n.ts` | Todas as traduções |
| `src/integrations/supabase/client.ts` | Cliente do banco de dados |
| `tailwind.config.ts` | Configuração de estilos |

### Links Úteis

- **Tailwind CSS**: https://tailwindcss.com/docs
- **React**: https://react.dev
- **Supabase**: https://supabase.com/docs
- **shadcn/ui**: https://ui.shadcn.com
- **TanStack Query**: https://tanstack.com/query
- **LiveKit**: https://docs.livekit.io

---

## 📝 Histórico de Versões

| Versão | Data | Alterações |
|--------|------|------------|
| 1.0 | - | Versão inicial do documento |
| 2.0 | - | Adicionado glossário e guia de navegação |
| 2.1 | - | Adicionada seção de Internacionalização (i18n) |

---

*Este documento foi criado para facilitar o onboarding de novos desenvolvedores no projeto.*
