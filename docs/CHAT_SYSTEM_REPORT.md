# 📋 RELATÓRIO COMPLETO: Sistema de Comunicação e Chat

> **Objetivo:** Este documento serve como prompt/briefing completo para replicar toda a infraestrutura de comunicação (chat, mensagens diretas, áudio, emojis, SuperChat, moderação e presença online) em outro projeto Lovable.

---

## 1. VISÃO GERAL DO SISTEMA

O sistema de comunicação é composto por **3 módulos principais**:

| Módulo | Descrição | Componente Principal |
|--------|-----------|---------------------|
| **Chat ao Vivo (Live Chat)** | Chat público em salas de transmissão ao vivo | `ChatBox.tsx` + `FloatingLiveChat.tsx` |
| **Mensagens Diretas (DM)** | Chat privado 1:1 entre usuários | `GlobalChatButton.tsx` + `DirectChatMessage.tsx` |
| **SuperChat (Monetização)** | Mensagens destacadas pagas via PIX | `SuperChatDialog.tsx` + `SuperChatDisplay.tsx` |

### Stack Técnica
- **Frontend:** React 18 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Supabase (Postgres + Realtime + Storage)
- **Realtime:** Supabase Realtime (postgres_changes + broadcast + presence)
- **Emojis:** `@emoji-mart/react` + `@emoji-mart/data`
- **Áudio:** Web Audio API (`MediaRecorder`, `AudioContext`, `AnalyserNode`)
- **Storage:** Supabase Storage bucket `chat-media` (público)

---

## 2. ESTRUTURA DE BANCO DE DADOS

### 2.1 Tabela `messages` (Chat ao Vivo)
```sql
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id),
  user_id uuid NOT NULL REFERENCES profiles(id),
  content text NOT NULL,
  type text NOT NULL DEFAULT 'text', -- 'text' | 'image' | 'audio'
  file_url text,
  duration integer, -- duração do áudio em segundos
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS Policies
-- Qualquer pessoa pode ver mensagens de salas ativas
CREATE POLICY "Anonymous can view messages in active rooms" ON messages
  FOR SELECT USING (EXISTS (SELECT 1 FROM rooms WHERE rooms.id = messages.room_id AND rooms.is_active = true));

-- Usuários autenticados podem inserir mensagens
CREATE POLICY "Authenticated users can insert messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Participantes podem ver mensagens
CREATE POLICY "Messages viewable by room participants" ON messages
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM rooms WHERE rooms.id = messages.room_id AND (rooms.creator_id = auth.uid() OR rooms.is_active = true)));

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
```

### 2.2 Tabela `direct_messages` (DMs)
```sql
CREATE TABLE public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  content text NOT NULL,
  message_type text NOT NULL DEFAULT 'text', -- 'text' | 'audio'
  metadata jsonb, -- { file_url, duration, reactions: { "😀": ["user_id_1", "user_id_2"] } }
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS Policies
CREATE POLICY "Users can send messages" ON direct_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can view own messages" ON direct_messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Senders can update own messages" ON direct_messages
  FOR UPDATE USING (auth.uid() = sender_id);

CREATE POLICY "Receivers can mark messages as read" ON direct_messages
  FOR UPDATE USING (auth.uid() = receiver_id);

CREATE POLICY "Users can delete own messages" ON direct_messages
  FOR DELETE USING (auth.uid() = sender_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
```

### 2.3 Tabela `chat_settings` (Moderação)
```sql
CREATE TABLE public.chat_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL UNIQUE REFERENCES rooms(id),
  slow_mode_enabled boolean DEFAULT false,
  slow_mode_duration integer DEFAULT 5, -- segundos entre mensagens
  subscribers_only boolean DEFAULT false,
  banned_words text[] DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: Qualquer pessoa pode ver, apenas criador da sala pode editar
CREATE POLICY "Anyone can view chat settings" ON chat_settings
  FOR SELECT USING (true);

CREATE POLICY "Room creators can manage chat settings" ON chat_settings
  FOR ALL USING (EXISTS (SELECT 1 FROM rooms WHERE rooms.id = chat_settings.room_id AND rooms.creator_id = auth.uid()));
```

### 2.4 Tabela `banned_users`
```sql
CREATE TABLE public.banned_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  banned_by uuid NOT NULL,
  room_id uuid NOT NULL REFERENCES rooms(id),
  reason text,
  is_permanent boolean DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: Criador da sala pode gerenciar bans
CREATE POLICY "Room creators can manage bans" ON banned_users
  FOR ALL USING (EXISTS (SELECT 1 FROM rooms WHERE rooms.id = banned_users.room_id AND rooms.creator_id = auth.uid()));
```

### 2.5 Tabela `superchats`
```sql
CREATE TABLE public.superchats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id),
  user_id uuid NOT NULL,
  creator_id uuid NOT NULL,
  message text NOT NULL,
  tier text NOT NULL, -- 'blue' | 'yellow' | 'red'
  amount integer NOT NULL, -- centavos
  duration_seconds integer NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'paid' | 'displaying' | 'displayed'
  payment_id text,
  displayed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.superchats;
```

### 2.6 Storage Bucket
```sql
-- Bucket público para mídia do chat (áudios)
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-media', 'chat-media', true);
```

---

## 3. COMPONENTES — DESCRIÇÃO DETALHADA

### 3.1 `GlobalChatButton.tsx` — Hub de Mensagens Diretas (898 linhas)

**Localização:** Botão flutuante fixo no canto inferior direito da tela.

**Estrutura visual:**
- Botão flutuante com ícone de mensagem + badge de não-lidas + avatares dos contatos recentes
- Janela tipo popup (Card) com 3 abas: "Conversas", "Amigos", "Chat"
- Minimizável e fechável

**Funcionalidades implementadas:**

#### a) Lista de Conversas
- Agrupa mensagens por parceiro de conversa (sender/receiver)
- Mostra última mensagem, horário relativo ("agora", "5m", "2h", "15/03")
- Badge com contagem de não-lidas por conversa
- Indicador de online/offline (bolinha verde/cinza no avatar)
- Ordenação por mensagem mais recente

#### b) Lista de Amigos
- Busca na tabela `user_follows` onde `follower_id = currentUser`
- Mostra avatar, username e status online/offline
- Clique abre chat direto

#### c) Chat 1:1
- Textarea auto-expansível (1-4 linhas, max 100px)
- Emoji picker (via `@emoji-mart/react`)
- Gravação de áudio (componente `RecordingWaveform`)
- Mensagens com bolhas diferenciadas (próprias = `bg-primary`, recebidas = `bg-muted`)
- Ações em mensagens próprias: Editar, Excluir (com confirmação), Reagir com emoji
- Ações em mensagens recebidas: Reagir com emoji
- Indicador "está digitando..." com animação de 3 pontos
- Som de notificação para mensagens recebidas (base64 WAV embutido)
- Marcação automática de leitura (update `read_at`)

#### d) Presença Online (Supabase Realtime Presence)
```typescript
const presenceChannel = supabase.channel("online-users", {
  config: { presence: { key: user.id } }
});
presenceChannel
  .on("presence", { event: "sync" }, () => { /* atualiza Set de IDs online */ })
  .on("presence", { event: "join" }, ({ key }) => { /* adiciona */ })
  .on("presence", { event: "leave" }, ({ key }) => { /* remove */ })
  .subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await presenceChannel.track({ user_id: user.id, online_at: new Date().toISOString() });
    }
  });
```

#### e) Typing Indicator (Supabase Realtime Broadcast)
```typescript
// Envio
const channelName = `typing-${[user.id, activeChat.id].sort().join('-')}`;
channel.send({ type: 'broadcast', event: 'typing', payload: { user_id: user.id } });

// Recepção
typingChannel.on('broadcast', { event: 'typing' }, (payload) => {
  if (payload.payload?.user_id === activeChat.id) {
    setIsTyping(true);
    setTimeout(() => setIsTyping(false), 3000);
  }
});
```

#### f) Abertura via Evento Global
```typescript
// Qualquer componente pode abrir o chat com um usuário específico
window.dispatchEvent(new CustomEvent("openChat", { detail: { id, name, avatar } }));
```

#### g) Reações em Mensagens
- Estrutura no `metadata.reactions`: `{ "😀": ["userId1", "userId2"], "❤️": ["userId3"] }`
- Toggle: clicar na mesma reação remove; clicar em nova adiciona
- Visual: badges arredondados abaixo da mensagem, com highlight se o usuário reagiu

#### h) Upload de Áudio
```typescript
const filename = `${user.id}/${Date.now()}.webm`;
await supabase.storage.from("chat-media").upload(filename, blob, { contentType: "audio/webm" });
const { data: urlData } = supabase.storage.from("chat-media").getPublicUrl(filename);
await supabase.from("direct_messages").insert({
  sender_id: user.id,
  receiver_id: activeChat.id,
  content: `🎤 Áudio (${duration}s)`,
  message_type: "audio",
  metadata: { file_url: urlData.publicUrl, duration }
});
```

---

### 3.2 `DirectChatMessage.tsx` — Mensagem Individual do DM (370 linhas)

**Props:**
```typescript
interface DirectChatMessageProps {
  message: { id, content, sender_id, created_at, message_type?, metadata? };
  isOwn: boolean;
  currentUserId: string;
  onDelete: (messageId: string) => Promise<void>;
  onEdit: (messageId: string, newContent: string) => Promise<void>;
  onReact: (messageId: string, emoji: string) => Promise<void>;
  isDeleting?: boolean;
}
```

**Comportamento:**
- Hover em mensagens próprias: menu dropdown aparece à esquerda (MoreHorizontal icon)
  - Opções: Reagir (abre emoji picker), Editar (inline textarea), Excluir (confirmação com ✓ e ✗)
- Hover em mensagens recebidas: botão de smile aparece à direita (reação rápida)
- Emoji picker: posicionado fixo no centro da tela (`position: fixed, top: 50%, left: 50%, transform: translate(-50%, -50%)`)
- Modo edição: textarea inline com Enter para salvar, Esc para cancelar
- Áudio: renderiza `DirectMessageAudioPlayer` ao invés de texto
- Reações: renderizadas abaixo da mensagem com `ring-1 ring-primary` se o usuário reagiu

---

### 3.3 `ChatBox.tsx` — Chat ao Vivo da Live (494 linhas)

**Props:**
```typescript
interface ChatBoxProps {
  roomId: string;
  currentUserId?: string | null;
  creatorId: string;
  isCreator?: boolean;
  disabled?: boolean;
  readOnly?: boolean; // Viewers não autenticados podem ver mas não enviar
}
```

**Funcionalidades:**
- Lista de mensagens com scroll automático
- Input de texto com max 500 caracteres
- Emoji picker (oculto em mobile)
- SuperChat suggestions (3 botões coloridos acima do input, apenas para não-criadores)
- Botão de SuperChat (ícone Coins)
- Typing indicator via Supabase Presence
- Realtime subscription para novas mensagens via `postgres_changes`
- Exibição de SuperChats ativos (componente `SuperChatDisplay`) fixada acima do input
- Limit de 100 mensagens em memória (performance)

**Typing via Presence:**
```typescript
const channel = supabase.channel(`typing:${roomId}`, {
  config: { presence: { key: currentUserId } }
});
// Track: { isTyping: true, username: "user" }
// Timeout de 2s para limpar typing
```

---

### 3.4 `FloatingLiveChat.tsx` — Chat Estilo Instagram Live (732 linhas)

**Objetivo:** Overlay transparente sobre o vídeo da live, estilo Instagram/TikTok Live.

**Características visuais:**
- Mensagens flutuantes com fundo `rgba(0, 0, 0, 0.4)` e bordas arredondadas (`rounded-2xl`)
- Máscara de gradiente: mensagens antigas desvanecem para cima
- Username em `text-primary font-bold`, conteúdo em `text-white`
- Input arredondado (`rounded-full`) com fundo translúcido
- SuperChat pinado acima do input com progress bar e timer

**Sistema de Fade:**
```typescript
// Mensagens desaparecem após 8 segundos
// Opacidade calculada em tempo real:
const getMessageOpacity = (createdAt: string) => {
  const age = Date.now() - new Date(createdAt).getTime();
  const fadeStart = messageFadeDelay * 0.7; // 70% do lifetime
  if (age < fadeStart) return 1;
  return Math.max(0, 1 - (age - fadeStart) / (messageFadeDelay - fadeStart));
};
// Multiplicador adicional por posição (mais antigo = mais transparente)
```

**Moderação integrada:**
- Slow mode: cooldown configurável entre mensagens
- Subscribers only: apenas assinantes podem enviar
- Banned words: filtro client-side antes de enviar
- Indicadores visuais para cada restrição ativa

**SuperChat pinado:**
- Componente `PinnedSuperchatDisplay`: pill arredondada com gradiente por tier
- Progress bar horizontal na base
- Timer em segundos
- Indicador de fila ("+N na fila")
- Prioridade: red > yellow > blue, depois por `created_at`

---

### 3.5 `ChatModerationPanel.tsx` — Painel de Moderação (251 linhas)

**Interface do criador para configurar:**
1. **Chat Apenas para Assinantes** — Switch toggle
2. **Modo Lento** — Switch + input de duração (1-120 segundos)
3. **Palavras Banidas** — Input + lista com botão de remoção (badges destrutivos)
4. **Banir Usuário** — Input de ID + botão "Banir"
5. **Botão "Salvar Configurações"** — Upsert na tabela `chat_settings`

---

### 3.6 Sistema de Áudio

#### `AudioRecorder.tsx` (212 linhas)
- Gravação via `MediaRecorder` API
- Waveform em tempo real via `AudioContext` + `AnalyserNode`
- 20 barras de frequência amostradas do `getByteFrequencyData`
- Timer visível durante gravação
- Botão vermelho pulsante com ícone ■ para parar
- Max duration: 60 segundos (auto-stop)
- MIME type: `audio/webm` (fallback `audio/mp4`)

#### `RecordingWaveform.tsx` (303 linhas)
- Versão aprimorada do AudioRecorder
- Usa `<canvas>` para renderização da waveform (mais suave)
- **Fluxo de 2 passos:** Gravar → Parar → Pré-visualizar (🎤 duração) → Enviar ou Cancelar
- 25 ou 35 barras conforme modo `compact`
- Smoothing: média de 7 amostras vizinhas por barra
- Cores via CSS variables HSL: `hsl(var(--destructive))`

#### `DirectMessageAudioPlayer.tsx` (215 linhas)
- Player com waveform real analisada do arquivo de áudio
- Busca o áudio, decodifica com `AudioContext.decodeAudioData()`
- Gera 40 barras de amplitude real do canal 0
- Waveform interativa: clique no canvas para seek
- Cores: barras tocadas = `hsl(var(--primary))`, barras restantes = `hsl(var(--muted-foreground) / 0.4)`
- Fallback: waveform pseudo-aleatória se decodificação falhar
- Exibe `currentTime/totalDuration` em font mono

#### `AudioPlayer.tsx` (143 linhas)
- Versão simplificada para o chat ao vivo
- Waveform pseudo-aleatória (seed-based, determinística por posição)
- 30 barras
- Mesmo sistema de seek por clique no canvas
- Usado no componente `ChatMessage`

---

### 3.7 `EmojiPicker.tsx` (56 linhas)

- Wrapper do `@emoji-mart/react` usando `Popover` do shadcn
- Props: `onEmojiSelect(emoji: string)`, `disabled`
- Posição: `side="top"`, `align="start"`, `sideOffset={8}`
- Config: `theme="dark"`, `locale="pt"`, `previewPosition="none"`, `perLine={8}`

---

### 3.8 `TypingIndicator.tsx` (42 linhas)

- 3 bolinhas animadas com `animate-bounce` e delays escalonados (0ms, 150ms, 300ms)
- Suporta 1 nome, 2 nomes ("X e Y estão digitando..."), ou N+ ("N pessoas estão digitando...")
- Internacionalizado via hook `useLanguage`

---

### 3.9 `SuperChatSuggestions.tsx` (57 linhas)

- 3 botões coloridos (Blue R$3, Yellow R$5, Red R$8)
- Texto alternado a cada 2s entre: valor → duração → "SuperChat"
- Cores: `bg-blue-500`, `bg-yellow-500`, `bg-red-500`

---

### 3.10 `SuperChatDialog.tsx` (197 linhas)

- Dialog modal para enviar SuperChat
- Seletor visual de 3 tiers com preview da mensagem
- Integração com pagamento PIX (componente `PixPaymentDialog`)
- Tiers: Blue (R$3, 60s), Yellow (R$5, 120s), Red (R$8, 180s)
- Fluxo: Selecionar tier → Escrever mensagem (max 200 chars) → Gerar QR PIX → Confirmar pagamento

---

### 3.11 `SuperChatDisplay.tsx` (114 linhas)

- Pill arredondada (`rounded-full`) com cor do tier
- Ícone Sparkles + Username + Timer + Mensagem
- Progress bar horizontal no rodapé (height 1px)
- Timer atualizado a cada 100ms para suavidade
- Remove-se automaticamente quando `timeLeft <= 0`

---

### 3.12 `SuperChatQueue.tsx` (181 linhas)

- Lista de SuperChats com status `pending` para o criador
- Ordenação: prioridade do tier (red=3, yellow=2, blue=1) → created_at
- Botão Play para o criador ativar um SuperChat (muda status para `displaying` + define `expires_at`)
- Realtime subscription para atualizações automáticas

---

## 4. DEPENDÊNCIAS NPM NECESSÁRIAS

```json
{
  "@emoji-mart/data": "^1.x",
  "@emoji-mart/react": "^1.x",
  "@supabase/supabase-js": "^2.x",
  "sonner": "^1.x",
  "lucide-react": "^0.x"
}
```

Além das dependências padrão do shadcn/ui (dialog, button, input, textarea, popover, card, scroll-area, avatar, dropdown-menu, badge, switch, label, tabs).

---

## 5. FLUXO DE DADOS E REALTIME

### 5.1 Canais Realtime Ativos

| Canal | Tipo | Propósito |
|-------|------|-----------|
| `online-users` | Presence | Rastreamento de presença global |
| `global-chat-messages` | postgres_changes | Atualizar lista de conversas do DM |
| `chat-${recipientId}` | postgres_changes | Mensagens em tempo real do DM ativo |
| `typing-${sortedUserIds}` | Broadcast | Indicador "digitando..." entre 2 usuários |
| `messages:${roomId}` | postgres_changes | Chat ao vivo da sala |
| `typing:${roomId}` | Presence | Indicador "digitando..." no chat ao vivo |
| `floating-chat:${roomId}` | postgres_changes | Chat flutuante (FloatingLiveChat) |
| `superchats:${roomId}` | postgres_changes | Fila de SuperChats |
| `superchats-display:${roomId}` | postgres_changes | Exibição ativa de SuperChats |

### 5.2 Pattern de Subscription
```typescript
// Padrão usado em todos os componentes:
useEffect(() => {
  // 1. Fetch inicial
  const fetchData = async () => { /* query supabase */ };
  fetchData();

  // 2. Subscribe realtime
  const channel = supabase
    .channel(`unique-channel-name`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "table_name", filter: `column=eq.${value}` },
      (payload) => { /* atualizar estado local */ }
    )
    .subscribe();

  // 3. Cleanup
  return () => { supabase.removeChannel(channel); };
}, [dependencies]);
```

---

## 6. PATTERNS DE IMPLEMENTAÇÃO

### 6.1 Busca de Username por ID
```typescript
// Padrão: buscar profiles separadamente e criar Map
const userIds = [...new Set(data.map(d => d.user_id))];
const { data: profiles } = await supabase
  .from("profiles") // ou "public_profiles" para dados públicos
  .select("id, username, avatar_url")
  .in("id", userIds);
const profileMap = new Map(profiles?.map(p => [p.id, p.username]) || []);
```

### 6.2 Scroll Automático
```typescript
useEffect(() => {
  if (scrollRef.current) {
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }
}, [messages]);
```

### 6.3 Notificação Sonora
```typescript
// Áudio inline base64 (sem dependência externa)
const notificationAudio = new Audio("data:audio/wav;base64,...");
notificationAudio.volume = 0.5;
// Ao receber mensagem:
notificationAudio.currentTime = 0;
notificationAudio.play().catch(() => {});
```

---

## 7. INTERNACIONALIZAÇÃO

Todas as strings usam o hook `useLanguage()` com fallback em português:
```typescript
const { t } = useLanguage();
// Uso: t.chat?.messages || "Mensagens"
// Chaves relevantes do objeto t.chat:
// messages, conversations, friends, noConversations, startConversation,
// noFriends, followToAdd, startChat, typeMessage, sendMessage,
// isTyping, areTyping, multipleTyping, react, edit, delete,
// confirmDelete, messageDeleted, messageEdited, deleteError, editError,
// audioError, recordAudio, stopRecording, liveChat, chatBlocked,
// buyCreditsToChat, sendError
```

---

## 8. INSTRUÇÕES PARA REPLICAÇÃO

### Passo 1: Criar as tabelas
Execute as migrations SQL da Seção 2 na ordem: `rooms` → `messages` → `direct_messages` → `chat_settings` → `banned_users` → `superchats`.

### Passo 2: Habilitar Realtime
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.superchats;
```

### Passo 3: Criar Storage Bucket
Criar bucket `chat-media` como público.

### Passo 4: Instalar dependências
```bash
npm install @emoji-mart/data @emoji-mart/react
```

### Passo 5: Criar componentes na ordem
1. `EmojiPicker.tsx` (sem dependências internas)
2. `TypingIndicator.tsx` (sem dependências internas)
3. `AudioPlayer.tsx` (sem dependências internas)
4. `DirectMessageAudioPlayer.tsx` (sem dependências internas)
5. `AudioRecorder.tsx` (sem dependências internas)
6. `RecordingWaveform.tsx` (sem dependências internas)
7. `ChatMessage.tsx` (depende de AudioPlayer)
8. `DirectChatMessage.tsx` (depende de DirectMessageAudioPlayer, EmojiPicker)
9. `SuperChatSuggestions.tsx` (sem dependências internas)
10. `SuperChatDisplay.tsx` (sem dependências internas)
11. `SuperChatDialog.tsx` (depende de integração de pagamento)
12. `SuperChatQueue.tsx` (depende de SuperChatDisplay)
13. `ChatModerationPanel.tsx` (depende de tabelas chat_settings e banned_users)
14. `ChatBox.tsx` (depende de ChatMessage, TypingIndicator, EmojiPicker, SuperChatSuggestions, SuperChatDisplay, SuperChatDialog)
15. `FloatingLiveChat.tsx` (depende de SuperChatSuggestions, SuperChatDialog)
16. `GlobalChatButton.tsx` (depende de EmojiPicker, RecordingWaveform, DirectChatMessage)

### Passo 6: Integrar no layout
- `GlobalChatButton` → renderizar no layout principal (`AppLayout`), recebendo `user` como prop
- `ChatBox` → renderizar na página de live como sidebar
- `FloatingLiveChat` → renderizar como overlay absoluto sobre o player de vídeo
- `ChatModerationPanel` → renderizar na página de gerenciamento de live do criador

---

## 9. CONSIDERAÇÕES DE PERFORMANCE

1. **Limite de mensagens em memória:** 100 no ChatBox, 30 no FloatingLiveChat
2. **Waveform via Canvas:** mais performático que DOM para animações de áudio
3. **`requestAnimationFrame`** para atualização suave da waveform durante gravação
4. **Debounce do typing:** timeout de 2-3 segundos para evitar spam de eventos
5. **Cleanup de canais Realtime:** todos os `useEffect` fazem `supabase.removeChannel()` no return
6. **Lazy loading de perfis:** usernames buscados apenas quando necessário via Map

---

## 10. RESUMO DOS ARQUIVOS

```
src/components/
├── GlobalChatButton.tsx          # Hub de DMs (898 linhas)
├── ChatBox.tsx                   # Chat ao vivo sidebar (494 linhas)
├── ChatModerationPanel.tsx       # Painel moderação (251 linhas)
├── SuperChatDialog.tsx           # Modal de envio SuperChat (197 linhas)
├── SuperChatDisplay.tsx          # Exibição SuperChat ativo (114 linhas)
├── SuperChatQueue.tsx            # Fila de SuperChats (181 linhas)
├── chat/
│   ├── AudioPlayer.tsx           # Player simples (143 linhas)
│   ├── AudioRecorder.tsx         # Gravador básico (212 linhas)
│   ├── ChatMessage.tsx           # Mensagem do chat ao vivo (80 linhas)
│   ├── DirectChatMessage.tsx     # Mensagem do DM com ações (370 linhas)
│   ├── DirectMessageAudioPlayer.tsx  # Player com waveform real (215 linhas)
│   ├── EmojiPicker.tsx           # Seletor de emojis (56 linhas)
│   ├── RecordingWaveform.tsx     # Gravador com canvas (303 linhas)
│   ├── SuperChatSuggestions.tsx  # Botões rápidos (57 linhas)
│   └── TypingIndicator.tsx       # Indicador digitando (42 linhas)
└── live/
    └── FloatingLiveChat.tsx      # Chat overlay Instagram-style (732 linhas)
```

**Total: ~4.347 linhas de código dedicadas ao sistema de comunicação.**
