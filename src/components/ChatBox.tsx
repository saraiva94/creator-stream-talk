import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Coins } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import SuperChatDialog, { SUPERCHAT_TIERS } from "./SuperChatDialog";
import SuperChatDisplay from "./SuperChatDisplay";
import { ChatMessage } from "./chat/ChatMessage";
import { TypingIndicator } from "./chat/TypingIndicator";
import { EmojiPicker } from "./chat/EmojiPicker";
import { SuperChatSuggestions } from "./chat/SuperChatSuggestions";

interface Message {
  id: string;
  content: string;
  type: "text" | "image" | "audio";
  file_url: string | null;
  duration: number | null;
  user_id: string;
  created_at: string;
  profiles: {
    username: string;
  };
}

interface ActiveSuperchat {
  id: string;
  message: string;
  tier: "blue" | "yellow" | "red";
  duration_seconds: number;
  username: string;
  expires_at: string;
}

interface ChatBoxProps {
  roomId: string;
  currentUserId?: string | null;
  creatorId: string;
  isCreator?: boolean;
  disabled?: boolean;
  readOnly?: boolean; // For unauthenticated viewers - can see messages but not send
}

interface TypingUser {
  id: string;
  username: string;
}

const ChatBox = ({ roomId, currentUserId, creatorId, isCreator = false, disabled = false, readOnly = false }: ChatBoxProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuperChat, setShowSuperChat] = useState(false);
  const [selectedTier, setSelectedTier] = useState<"blue" | "yellow" | "red" | null>(null);
  const [activeSuperchats, setActiveSuperchats] = useState<ActiveSuperchat[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [currentUsername, setCurrentUsername] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const { toast } = useToast();
  const { t } = useLanguage();

  // Fetch current user's username
  useEffect(() => {
    if (!currentUserId) return;
    
    const fetchUsername = async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", currentUserId)
          .maybeSingle();
        if (data) setCurrentUsername(data.username);
      } catch (err) {
        console.error("[ChatBox] Error fetching username:", err);
      }
    };
    fetchUsername();
  }, [currentUserId]);

  // Setup presence channel for typing indicator
  useEffect(() => {
    if (!currentUsername || disabled || readOnly || !currentUserId) return;

    const channel = supabase.channel(`typing:${roomId}`, {
      config: { presence: { key: currentUserId } }
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const users: TypingUser[] = [];
        
        Object.entries(state).forEach(([key, presences]) => {
          if (key !== currentUserId && Array.isArray(presences)) {
            presences.forEach((presence) => {
              const p = presence as unknown as { isTyping?: boolean; username?: string };
              if (p.isTyping && p.username) {
                users.push({ id: key, username: p.username });
              }
            });
          }
        });
        
        setTypingUsers(users);
      })
      .subscribe();

    presenceChannelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [roomId, currentUserId, currentUsername, disabled]);

  // Handle typing broadcast
  const broadcastTyping = useCallback((isTyping: boolean) => {
    if (!presenceChannelRef.current || !currentUsername) return;
    
    presenceChannelRef.current.track({
      isTyping,
      username: currentUsername
    });
  }, [currentUsername]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    // Broadcast typing
    broadcastTyping(true);
    
    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      broadcastTyping(false);
    }, 2000);
  };

  // Fetch active superchats
  useEffect(() => {
    const fetchActiveSuperchats = async () => {
      const { data, error } = await supabase
        .from("superchats")
        .select("*")
        .eq("room_id", roomId)
        .eq("status", "displaying")
        .gt("expires_at", new Date().toISOString());

      if (error) {
        console.error("Error fetching active superchats:", error);
        return;
      }

      const userIds = [...new Set((data || []).map(d => d.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.username]) || []);

      const formatted = (data || []).map((item) => ({
        id: item.id,
        message: item.message,
        tier: item.tier as "blue" | "yellow" | "red",
        duration_seconds: item.duration_seconds,
        username: profileMap.get(item.user_id) || "Usuário",
        expires_at: item.expires_at || "",
      }));

      setActiveSuperchats(formatted);
    };

    fetchActiveSuperchats();

    const superchatChannel = supabase
      .channel(`superchats-display:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "superchats",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          fetchActiveSuperchats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(superchatChannel);
    };
  }, [roomId]);

  // Fetch messages - optimized with parallel loading
  const messagesLoadedRef = useRef(false);
  
  useEffect(() => {
    console.log("[ChatBox] Effect triggered, roomId:", roomId, "messagesLoaded:", messagesLoadedRef.current);
    if (!roomId || messagesLoadedRef.current) return;
    
    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from("messages")
          .select(`
            id,
            content,
            type,
            file_url,
            duration,
            user_id,
            created_at,
            profiles (username)
          `)
          .eq("room_id", roomId)
          .order("created_at", { ascending: true })
          .limit(100); // Limit initial load for performance

        if (error) {
          console.error("Error fetching messages:", error);
          return;
        }

        const formattedMessages: Message[] = (data || []).map(m => ({
          id: m.id,
          content: m.content,
          type: (m.type || "text") as "text" | "image" | "audio",
          file_url: m.file_url,
          duration: m.duration,
          user_id: m.user_id,
          created_at: m.created_at,
          profiles: { username: m.profiles?.username || "Usuário" }
        }));

        setMessages(formattedMessages);
        messagesLoadedRef.current = true;
      } catch (err) {
        console.error("[ChatBox] Error loading messages:", err);
      }
    };

    fetchMessages();

    // Set up realtime subscription
    console.log("[ChatBox] Setting up realtime subscription for roomId:", roomId);
    const channel = supabase
      .channel(`messages:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          console.log("[ChatBox] Realtime message received:", payload.new);
          const newMsg = payload.new as {
            id: string;
            content: string;
            type?: string;
            file_url?: string;
            duration?: number;
            user_id: string;
            created_at: string;
          };
          
          // Fetch username for new message
          const { data: profileData } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", newMsg.user_id)
            .maybeSingle();

          setMessages((prev) => [
            ...prev.slice(-99), // Keep only last 100 messages for performance
            {
              id: newMsg.id,
              content: newMsg.content,
              type: (newMsg.type || "text") as "text" | "image" | "audio",
              file_url: newMsg.file_url || null,
              duration: newMsg.duration || null,
              user_id: newMsg.user_id,
              created_at: newMsg.created_at,
              profiles: { username: profileData?.username || "Usuário" },
            },
          ]);
        },
      )
      .subscribe((status) => {
        console.log("[ChatBox] Realtime subscription status:", status, "for roomId:", roomId);
      });

    return () => {
      console.log("[ChatBox] Cleanup - removing channel for roomId:", roomId);
      supabase.removeChannel(channel);
      messagesLoadedRef.current = false;
    };
  }, [roomId]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Send text message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setLoading(true);
    broadcastTyping(false);
    
    try {
      const { error } = await supabase.from("messages").insert({
        room_id: roomId,
        user_id: currentUserId,
        content: newMessage.trim(),
        type: "text",
      });

      if (error) throw error;
      setNewMessage("");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t.chat?.sendError || "Erro ao enviar mensagem";
      toast({
        title: t.chat?.sendError || "Erro ao enviar mensagem",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSuperchatExpire = useCallback(async (id: string) => {
    setActiveSuperchats((prev) => prev.filter((sc) => sc.id !== id));
    
    await supabase
      .from("superchats")
      .update({ status: "displayed" })
      .eq("id", id);
  }, []);

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage((prev) => prev + emoji);
  };

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold">{t.chat?.liveChat || "Chat ao vivo"}</h3>
        <p className="text-xs text-muted-foreground">
          {messages.length} {t.chat?.messages || "mensagens"}
        </p>
      </div>

      {/* Messages area with flex-1 to take available space */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-3">
          {messages.map((message) => (
            <ChatMessage 
              key={message.id} 
              message={message} 
              currentUserId={currentUserId || ""}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Active SuperChats - Fixed at bottom of chat area, above input */}
      {activeSuperchats.length > 0 && (
        <div className="p-2 border-t border-border space-y-2 bg-background/80 backdrop-blur-sm sticky bottom-0">
          {activeSuperchats.map((superchat) => (
            <SuperChatDisplay
              key={superchat.id}
              superchat={superchat}
              onExpire={handleSuperchatExpire}
            />
          ))}
        </div>
      )}

      {/* Typing indicator */}
      <TypingIndicator usernames={typingUsers.map(u => u.username)} />

      {/* Hidden file input - removed from live chat */}

      <form onSubmit={handleSendMessage} className="p-3 border-t border-border">
        {readOnly ? (
          <div className="text-center py-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              {t.liveViewer?.loginToChat || "Faça login para participar do chat"}
            </p>
          </div>
        ) : disabled ? (
          <div className="text-center py-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              {t.chat?.chatBlocked || "Chat bloqueado"}
            </p>
            <p className="text-xs text-muted-foreground">
              {t.chat?.buyCreditsToChat || "Compre créditos para participar do chat"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* SuperChat Suggestions - above input for non-creators */}
            {!isCreator && (
              <SuperChatSuggestions 
                onSelect={(tier) => {
                  setSelectedTier(tier);
                  setShowSuperChat(true);
                }}
              />
            )}
            
            <div className="flex items-center gap-1 sm:gap-2">
              {/* SuperChat button (non-creators only) - hidden on very small screens */}
              {!isCreator && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setShowSuperChat(true)}
                  title="Enviar SuperChat"
                  className="shrink-0 text-muted-foreground hover:text-yellow-500 h-8 w-8 sm:h-10 sm:w-10"
                >
                  <Coins className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              )}

              {/* Emoji picker - hidden on mobile */}
              <div className="hidden sm:block">
                <EmojiPicker 
                  onEmojiSelect={handleEmojiSelect}
                  disabled={loading}
                />
              </div>

              {/* Text input */}
              <Input
                value={newMessage}
                onChange={handleInputChange}
                placeholder={t.chat?.typeMessage || "Digite sua mensagem..."}
                disabled={loading}
                maxLength={500}
                className="flex-1 border-primary/50 focus-visible:ring-primary h-8 sm:h-10 text-sm"
              />

              {/* Send button */}
              <Button 
                type="submit" 
                size="icon" 
                disabled={loading || !newMessage.trim()}
                title={t.chat?.sendMessage || "Enviar mensagem"}
                className="shrink-0 h-8 w-8 sm:h-10 sm:w-10"
              >
                <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
            </div>
          </div>
        )}
      </form>

      <SuperChatDialog
        open={showSuperChat}
        onOpenChange={(open) => {
          setShowSuperChat(open);
          if (!open) setSelectedTier(null);
        }}
        creatorId={creatorId}
        userId={currentUserId || ""}
        roomId={roomId}
        initialTier={selectedTier}
      />
    </div>
  );
};

export default ChatBox;
