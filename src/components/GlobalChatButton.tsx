import { useState, useEffect } from "react";
import { MessageCircle, X, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";
import type { User } from "@supabase/supabase-js";

interface Conversation {
  id: string;
  recipientId: string;
  recipientName: string;
  recipientAvatar: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

interface GlobalChatButtonProps {
  user: User | null;
}

export const GlobalChatButton = ({ user }: GlobalChatButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const { t } = useLanguage();

  // Fetch conversations
  useEffect(() => {
    if (!user) return;

    const fetchConversations = async () => {
      // Get all messages where user is sender or receiver
      const { data: messages } = await supabase
        .from("direct_messages")
        .select("*")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (!messages) return;

      // Group by conversation partner
      const conversationMap = new Map<string, {
        recipientId: string;
        lastMessage: string;
        lastMessageAt: string;
        unreadCount: number;
      }>();

      messages.forEach((msg) => {
        const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        
        if (!conversationMap.has(partnerId)) {
          conversationMap.set(partnerId, {
            recipientId: partnerId,
            lastMessage: msg.content,
            lastMessageAt: msg.created_at,
            unreadCount: msg.receiver_id === user.id && !msg.read_at ? 1 : 0,
          });
        } else {
          const existing = conversationMap.get(partnerId)!;
          if (msg.receiver_id === user.id && !msg.read_at) {
            existing.unreadCount++;
          }
        }
      });

      // Fetch profile info for each partner
      const partnerIds = Array.from(conversationMap.keys());
      if (partnerIds.length === 0) {
        setConversations([]);
        setUnreadTotal(0);
        return;
      }

      const { data: profiles } = await supabase
        .from("public_profiles")
        .select("id, username, avatar_url")
        .in("id", partnerIds);

      const profileMap = new Map(
        profiles?.map((p) => [p.id, { username: p.username, avatar_url: p.avatar_url }]) || []
      );

      const convList: Conversation[] = [];
      let totalUnread = 0;

      conversationMap.forEach((conv, partnerId) => {
        const profile = profileMap.get(partnerId);
        totalUnread += conv.unreadCount;
        convList.push({
          id: partnerId,
          recipientId: partnerId,
          recipientName: profile?.username || "Usuário",
          recipientAvatar: profile?.avatar_url || null,
          lastMessage: conv.lastMessage,
          lastMessageAt: conv.lastMessageAt,
          unreadCount: conv.unreadCount,
        });
      });

      // Sort by last message
      convList.sort((a, b) => 
        new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );

      setConversations(convList);
      setUnreadTotal(totalUnread);
    };

    fetchConversations();

    // Subscribe to new messages
    const channel = supabase
      .channel("global-chat-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
        },
        (payload) => {
          const msg = payload.new as { sender_id: string; receiver_id: string };
          if (msg.sender_id === user.id || msg.receiver_id === user.id) {
            fetchConversations();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (!user) return null;

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return "agora";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  return (
    <>
      {/* Floating Button - Bottom Right */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setIsMinimized(false);
        }}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full",
          "bg-card border border-border shadow-xl hover:bg-muted transition-all",
          "hover:scale-105 active:scale-95"
        )}
      >
        <MessageCircle className="h-5 w-5 text-foreground" />
        <span className="text-sm font-medium text-foreground">
          {t.chat?.messages || "Mensagens"}
        </span>
        {unreadTotal > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadTotal > 9 ? "9+" : unreadTotal}
          </span>
        )}
        {/* User avatars preview */}
        {conversations.length > 0 && (
          <div className="flex -space-x-2 ml-1">
            {conversations.slice(0, 2).map((conv) => (
              <Avatar key={conv.id} className="w-6 h-6 border-2 border-card">
                <AvatarImage src={conv.recipientAvatar || undefined} />
                <AvatarFallback className="text-[10px]">
                  {conv.recipientName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && !isMinimized && (
        <Card className="fixed bottom-20 right-6 w-80 sm:w-96 max-h-[500px] z-50 shadow-2xl border-border overflow-hidden">
          <CardHeader className="py-3 px-4 border-b border-border flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">
              {t.chat?.messages || "Mensagens"}
            </CardTitle>
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setIsMinimized(true)}
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {conversations.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Nenhuma conversa</p>
                <p className="text-xs mt-1">
                  Acesse o perfil de um usuário para iniciar
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[350px]">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    className="w-full p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left border-b border-border/50"
                    onClick={() => {
                      // Navigate to user's profile or open chat
                      window.location.href = `/u/${conv.recipientName}`;
                    }}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={conv.recipientAvatar || undefined} />
                      <AvatarFallback>
                        {conv.recipientName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate">
                          {conv.recipientName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(conv.lastMessageAt)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {conv.lastMessage}
                      </p>
                    </div>
                    {conv.unreadCount > 0 && (
                      <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {conv.unreadCount}
                      </span>
                    )}
                  </button>
                ))}
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
};

export default GlobalChatButton;
