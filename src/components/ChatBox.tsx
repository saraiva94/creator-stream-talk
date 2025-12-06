import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Coins } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import SuperChatDialog from "./SuperChatDialog";
import SuperChatDisplay from "./SuperChatDisplay";

interface Message {
  id: string;
  content: string;
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
  currentUserId: string;
  creatorId: string;
  isCreator?: boolean;
  disabled?: boolean;
}

type SupabaseMessageRow = {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  profiles?: {
    username?: string | null;
  } | null;
};

type SupabaseSuperChatRow = {
  id: string;
  message: string;
  tier: string;
  duration_seconds: number;
  expires_at: string;
  status: string;
  user_id: string;
  profiles?: {
    username?: string | null;
  } | null;
};

const ChatBox = ({ roomId, currentUserId, creatorId, isCreator = false, disabled = false }: ChatBoxProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuperChat, setShowSuperChat] = useState(false);
  const [activeSuperchats, setActiveSuperchats] = useState<ActiveSuperchat[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

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

      // Fetch usernames separately
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

    // Subscribe to superchat changes
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

  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select(`
          *,
          profiles (username)
        `)
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching messages:", error);
        return;
      }

      setMessages(data || []);
    };

    fetchMessages();

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
        async (payload: { new: SupabaseMessageRow }) => {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", payload.new.user_id)
            .single();

          setMessages((prev) => [
            ...prev,
            {
              ...payload.new,
              profiles: { username: profileData?.username || "Usuário" },
            },
          ]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("messages").insert({
        room_id: roomId,
        user_id: currentUserId,
        content: newMessage.trim(),
      });

      if (error) throw error;
      setNewMessage("");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao enviar mensagem";
      toast({
        title: "Erro ao enviar mensagem",
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

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold">Chat ao vivo</h3>
        <p className="text-xs text-muted-foreground">
          {messages.length} mensagens
        </p>
      </div>

      {/* Active SuperChats - Pinned at bottom of video area */}
      {activeSuperchats.length > 0 && (
        <div className="p-2 border-b border-border space-y-2 bg-background/50">
          {activeSuperchats.map((superchat) => (
            <SuperChatDisplay
              key={superchat.id}
              superchat={superchat}
              onExpire={handleSuperchatExpire}
            />
          ))}
        </div>
      )}

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-3">
          {messages.map((message) => (
            <div key={message.id} className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-sm font-semibold ${
                    message.user_id === currentUserId
                      ? "text-primary"
                      : "text-foreground"
                  }`}
                >
                  {message.profiles.username}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(message.created_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="text-sm text-foreground">{message.content}</p>
            </div>
          ))}
        </div>
      </ScrollArea>

      <form onSubmit={handleSendMessage} className="p-4 border-t border-border">
        {disabled ? (
          <div className="text-center py-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              Chat bloqueado
            </p>
            <p className="text-xs text-muted-foreground">
              Compre créditos para participar do chat
            </p>
          </div>
        ) : (
          <div className="flex gap-2">
            {!isCreator && (
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => setShowSuperChat(true)}
                title="Enviar SuperChat"
              >
                <Coins className="h-4 w-4" />
              </Button>
            )}
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Digite sua mensagem..."
              disabled={loading}
              maxLength={500}
            />
            <Button type="submit" size="icon" disabled={loading || !newMessage.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
      </form>

      <SuperChatDialog
        open={showSuperChat}
        onOpenChange={setShowSuperChat}
        creatorId={creatorId}
        userId={currentUserId}
        roomId={roomId}
      />
    </div>
  );
};

export default ChatBox;
