import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingMessage {
  id: string;
  content: string;
  username: string;
  created_at: string;
  isNew?: boolean;
}

interface FloatingLiveChatProps {
  roomId: string;
  currentUserId: string | null;
  isAuthenticated: boolean;
  disabled?: boolean;
  maxVisibleMessages?: number;
  messageFadeDelay?: number; // ms before message starts fading
}

const FloatingLiveChat: React.FC<FloatingLiveChatProps> = ({
  roomId,
  currentUserId,
  isAuthenticated,
  disabled = false,
  maxVisibleMessages = 8,
  messageFadeDelay = 10000, // 10 seconds
}) => {
  const [messages, setMessages] = useState<FloatingMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch recent messages
  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select(`
          id,
          content,
          created_at,
          profiles (username)
        `)
        .eq("room_id", roomId)
        .eq("type", "text")
        .order("created_at", { ascending: false })
        .limit(maxVisibleMessages);

      if (error) {
        console.error("Error fetching messages:", error);
        return;
      }

      const formatted: FloatingMessage[] = (data || [])
        .reverse()
        .map((m) => ({
          id: m.id,
          content: m.content,
          username: m.profiles?.username || "Usuário",
          created_at: m.created_at,
        }));

      setMessages(formatted);
    };

    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`floating-chat:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const newMsg = payload.new as {
            id: string;
            content: string;
            type?: string;
            created_at: string;
            user_id: string;
          };

          // Only show text messages in floating chat
          if (newMsg.type && newMsg.type !== "text") return;

          const { data: profileData } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", newMsg.user_id)
            .single();

          const formattedMsg: FloatingMessage = {
            id: newMsg.id,
            content: newMsg.content,
            username: profileData?.username || "Usuário",
            created_at: newMsg.created_at,
            isNew: true,
          };

          setMessages((prev) => {
            const updated = [...prev, formattedMsg];
            // Keep only the last maxVisibleMessages
            return updated.slice(-maxVisibleMessages);
          });

          // Remove isNew flag after animation
          setTimeout(() => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === newMsg.id ? { ...m, isNew: false } : m
              )
            );
          }, 500);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, maxVisibleMessages]);

  // Auto-fade old messages
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setMessages((prev) =>
        prev.filter((m) => {
          const msgTime = new Date(m.created_at).getTime();
          return now - msgTime < messageFadeDelay;
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [messageFadeDelay]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUserId || sending) return;

    setSending(true);
    try {
      const { error } = await supabase.from("messages").insert({
        room_id: roomId,
        user_id: currentUserId,
        content: newMessage.trim(),
        type: "text",
      });

      if (error) throw error;
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
    }
  };

  // Calculate opacity based on message age
  const getMessageOpacity = (createdAt: string) => {
    const age = Date.now() - new Date(createdAt).getTime();
    const fadeStart = messageFadeDelay * 0.7; // Start fading at 70% of lifetime
    
    if (age < fadeStart) return 1;
    
    const fadeProgress = (age - fadeStart) / (messageFadeDelay - fadeStart);
    return Math.max(0, 1 - fadeProgress);
  };

  return (
    <div className="absolute bottom-24 left-0 right-16 z-10 pointer-events-none">
      {/* Messages container - floating over video */}
      <div className="flex flex-col justify-end px-3 pb-2 max-h-48 overflow-hidden">
        {messages.map((message, index) => {
          const opacity = getMessageOpacity(message.created_at);
          const isOlder = index < messages.length - 4;
          
          return (
            <div
              key={message.id}
              className={cn(
                "flex items-start gap-2 py-1 transition-all duration-500",
                message.isNew && "animate-slide-in-bottom"
              )}
              style={{ 
                opacity: isOlder ? opacity * 0.6 : opacity,
                transform: `translateY(${message.isNew ? '0' : '0'})`,
              }}
            >
              <div 
                className="inline-flex items-baseline gap-1.5 px-2.5 py-1 rounded-full max-w-[85%]"
                style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
              >
                <span className="text-primary font-semibold text-xs shrink-0">
                  {message.username}
                </span>
                <span className="text-white text-xs break-words">
                  {message.content}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input area - always visible at bottom left */}
      {isAuthenticated && !disabled && (
        <form 
          onSubmit={handleSend} 
          className="px-3 pointer-events-auto"
        >
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                ref={inputRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Enviar mensagem..."
                className="bg-black/50 border-white/20 text-white placeholder:text-white/50 text-sm h-9 pr-10 rounded-full backdrop-blur-sm"
                disabled={sending}
              />
              <Button
                type="submit"
                size="icon"
                variant="ghost"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-white hover:bg-white/20 rounded-full"
                disabled={!newMessage.trim() || sending}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* Login prompt for unauthenticated users */}
      {!isAuthenticated && (
        <div className="px-3 pointer-events-auto">
          <div 
            className="px-3 py-2 rounded-full text-center text-white/70 text-xs"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          >
            Faça login para enviar mensagens
          </div>
        </div>
      )}
    </div>
  );
};

export default FloatingLiveChat;
