import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingMessage {
  id: string;
  content: string;
  username: string;
  created_at: string;
  isNew?: boolean;
}

interface ActiveSuperchat {
  id: string;
  message: string;
  username: string;
  tier: "blue" | "yellow" | "red";
  amount: number;
  expires_at: string;
  created_at: string;
}

interface FloatingLiveChatProps {
  roomId: string;
  currentUserId: string | null;
  isAuthenticated: boolean;
  disabled?: boolean;
  maxVisibleMessages?: number;
  messageFadeDelay?: number; // ms before message starts fading
}

// Tier colors and priority (higher = more priority)
const TIER_CONFIG = {
  red: { bg: "bg-red-500/90", text: "text-white", priority: 3, glow: "shadow-red-500/50" },
  yellow: { bg: "bg-yellow-500/90", text: "text-black", priority: 2, glow: "shadow-yellow-500/50" },
  blue: { bg: "bg-blue-500/90", text: "text-white", priority: 1, glow: "shadow-blue-500/50" },
};

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
  const [activeSuperchat, setActiveSuperchat] = useState<ActiveSuperchat | null>(null);
  const [superchatQueue, setSuperchatQueue] = useState<ActiveSuperchat[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch and subscribe to superchats
  useEffect(() => {
    const fetchSuperchats = async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("superchats")
        .select(`
          id,
          message,
          tier,
          amount,
          expires_at,
          created_at,
          profiles:user_id (username)
        `)
        .eq("room_id", roomId)
        .eq("status", "paid")
        .gt("expires_at", now)
        .order("amount", { ascending: false })
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching superchats:", error);
        return;
      }

      const formatted: ActiveSuperchat[] = (data || []).map((sc: any) => ({
        id: sc.id,
        message: sc.message,
        username: sc.profiles?.username || "Usuário",
        tier: sc.tier as "blue" | "yellow" | "red",
        amount: sc.amount,
        expires_at: sc.expires_at,
        created_at: sc.created_at,
      }));

      setSuperchatQueue(formatted);
    };

    fetchSuperchats();

    // Subscribe to new superchats
    const superchatChannel = supabase
      .channel(`superchats:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "superchats",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const newSc = payload.new as any;
          
          if (newSc.status !== "paid") return;

          const { data: profileData } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", newSc.user_id)
            .single();

          const formatted: ActiveSuperchat = {
            id: newSc.id,
            message: newSc.message,
            username: profileData?.username || "Usuário",
            tier: newSc.tier,
            amount: newSc.amount,
            expires_at: newSc.expires_at,
            created_at: newSc.created_at,
          };

          setSuperchatQueue((prev) => {
            const updated = [...prev, formatted];
            // Sort by amount (desc) then by created_at (asc)
            return updated.sort((a, b) => {
              if (b.amount !== a.amount) return b.amount - a.amount;
              return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            });
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "superchats",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          // Remove if status changed or expired
          if (updated.status !== "paid") {
            setSuperchatQueue((prev) => prev.filter((sc) => sc.id !== updated.id));
            if (activeSuperchat?.id === updated.id) {
              setActiveSuperchat(null);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(superchatChannel);
    };
  }, [roomId]);

  // Remove expired superchats and select active one
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      
      // Remove expired from queue
      setSuperchatQueue((prev) => 
        prev.filter((sc) => new Date(sc.expires_at).getTime() > now)
      );

      // Check if active superchat expired
      if (activeSuperchat && new Date(activeSuperchat.expires_at).getTime() <= now) {
        setActiveSuperchat(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSuperchat]);

  // Auto-select next superchat when current expires
  useEffect(() => {
    if (!activeSuperchat && superchatQueue.length > 0) {
      // Get highest priority superchat (already sorted)
      setActiveSuperchat(superchatQueue[0]);
    }
  }, [activeSuperchat, superchatQueue]);

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

  // Calculate remaining time for superchat
  const getSuperchatRemainingTime = (expiresAt: string): number => {
    return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none" style={{ height: '30vh' }}>
      {/* Gradient mask for fading effect at top */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, transparent 0%, transparent 100%)',
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 40%, black 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 40%, black 100%)',
        }}
      />
      
      {/* Messages container - Instagram Live style */}
      <div className="flex flex-col justify-end h-full px-3 pb-28">
        <div className="flex flex-col gap-1 overflow-hidden">
          {messages.map((message, index) => {
            const opacity = getMessageOpacity(message.created_at);
            const positionFromBottom = messages.length - 1 - index;
            const fadeMultiplier = positionFromBottom > 4 ? 0.3 : positionFromBottom > 2 ? 0.6 : 1;
            
            return (
              <div
                key={message.id}
                className={cn(
                  "flex items-start transition-all duration-500",
                  message.isNew && "animate-slide-in-bottom"
                )}
                style={{ 
                  opacity: opacity * fadeMultiplier,
                }}
              >
                <div 
                  className="inline-flex items-baseline gap-1.5 px-3 py-1.5 rounded-2xl max-w-[80%]"
                  style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
                >
                  <span className="text-primary font-bold text-sm shrink-0">
                    {message.username}
                  </span>
                  <span className="text-white text-sm break-words">
                    {message.content}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pinned SuperChat - above input */}
      {activeSuperchat && (
        <div className="absolute bottom-16 left-3 right-3 pointer-events-auto">
          <div 
            className={cn(
              "rounded-xl px-4 py-3 shadow-lg animate-pulse-slow",
              TIER_CONFIG[activeSuperchat.tier].bg,
              TIER_CONFIG[activeSuperchat.tier].text,
              "shadow-xl",
              TIER_CONFIG[activeSuperchat.tier].glow
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                <span className="font-bold text-sm">{activeSuperchat.username}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium opacity-80">
                  R$ {(activeSuperchat.amount / 100).toFixed(2)}
                </span>
                <span className="text-xs font-bold bg-black/20 px-2 py-0.5 rounded-full">
                  {getSuperchatRemainingTime(activeSuperchat.expires_at)}s
                </span>
              </div>
            </div>
            <p className="text-sm font-medium break-words">{activeSuperchat.message}</p>
          </div>
          
          {/* Queue indicator */}
          {superchatQueue.length > 1 && (
            <div className="mt-1 text-center">
              <span className="text-white/70 text-xs bg-black/40 px-2 py-0.5 rounded-full">
                +{superchatQueue.length - 1} na fila
              </span>
            </div>
          )}
        </div>
      )}

      {/* Input area - fixed at bottom like Instagram */}
      <div className="absolute bottom-0 left-0 right-0 px-3 pb-4 pointer-events-auto">
        {isAuthenticated && !disabled ? (
          <form onSubmit={handleSend}>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  ref={inputRef}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Comentar..."
                  className="bg-black/40 border-white/20 text-white placeholder:text-white/60 text-sm h-10 pr-10 rounded-full backdrop-blur-sm"
                  disabled={sending}
                />
                <Button
                  type="submit"
                  size="icon"
                  variant="ghost"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-white hover:bg-white/20 rounded-full"
                  disabled={!newMessage.trim() || sending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </form>
        ) : (
          <div 
            className="px-4 py-2.5 rounded-full text-white/70 text-sm"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
          >
            Faça login para comentar
          </div>
        )}
      </div>
    </div>
  );
};

export default FloatingLiveChat;
