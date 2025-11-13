import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Coins } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import SuperChatDialog from "./SuperChatDialog";

interface Message {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  profiles: {
    username: string;
  };
}

interface ChatBoxProps {
  roomId: string;
  currentUserId: string;
  creatorId: string;
}

const ChatBox = ({ roomId, currentUserId, creatorId }: ChatBoxProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuperChat, setShowSuperChat] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

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
        async (payload) => {
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
            } as Message,
          ]);
        }
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
    } catch (error: any) {
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold">Chat ao vivo</h3>
        <p className="text-xs text-muted-foreground">
          {messages.length} mensagens
        </p>
      </div>

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
        <div className="flex gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => setShowSuperChat(true)}
            title="Enviar SuperChat"
          >
            <Coins className="h-4 w-4" />
          </Button>
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
      </form>

      <SuperChatDialog
        open={showSuperChat}
        onOpenChange={setShowSuperChat}
        creatorId={creatorId}
        userId={currentUserId}
      />
    </div>
  );
};

export default ChatBox;
