import { useState, useEffect, useCallback } from "react";
import { MessageCircle, X, Minimize2, ArrowLeft, Users, Send, Mic, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";
import type { User } from "@supabase/supabase-js";
import { EmojiPicker } from "./chat/EmojiPicker";

interface Conversation {
  id: string;
  recipientId: string;
  recipientName: string;
  recipientAvatar: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

interface Friend {
  id: string;
  username: string;
  avatar_url: string | null;
  isOnline?: boolean;
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
}

interface GlobalChatButtonProps {
  user: User | null;
}

export const GlobalChatButton = ({ user }: GlobalChatButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [activeTab, setActiveTab] = useState<"conversas" | "amigos" | "chat">("conversas");
  const [activeChat, setActiveChat] = useState<{ id: string; name: string; avatar: string | null } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const { t } = useLanguage();

  // Animate button entrance on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  // Track user presence
  useEffect(() => {
    if (!user) return;

    const presenceChannel = supabase.channel("online-users", {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const onlineIds = new Set<string>();
        Object.keys(state).forEach((key) => {
          onlineIds.add(key);
        });
        setOnlineUsers(onlineIds);
      })
      .on("presence", { event: "join" }, ({ key }) => {
        setOnlineUsers((prev) => new Set([...prev, key]));
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [user]);

  // Listen for openChat events from profile pages
  useEffect(() => {
    const handleOpenChat = (event: CustomEvent<{ id: string; name: string; avatar: string | null }>) => {
      setIsOpen(true);
      setIsMinimized(false);
      setActiveChat({ id: event.detail.id, name: event.detail.name, avatar: event.detail.avatar });
      setActiveTab("chat");
    };

    window.addEventListener("openChat", handleOpenChat as EventListener);
    return () => {
      window.removeEventListener("openChat", handleOpenChat as EventListener);
    };
  }, []);

  // Fetch conversations
  useEffect(() => {
    if (!user) return;

    const fetchConversations = async () => {
      const { data: messages } = await supabase
        .from("direct_messages")
        .select("*")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (!messages) return;

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

      convList.sort((a, b) => 
        new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );

      setConversations(convList);
      setUnreadTotal(totalUnread);
    };

    fetchConversations();

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

  // Fetch friends (people user follows)
  useEffect(() => {
    if (!user) return;

    const fetchFriends = async () => {
      const { data: follows } = await supabase
        .from("user_follows")
        .select("following_id")
        .eq("follower_id", user.id);

      if (!follows || follows.length === 0) {
        setFriends([]);
        return;
      }

      const followingIds = follows.map(f => f.following_id);

      const { data: profiles } = await supabase
        .from("public_profiles")
        .select("id, username, avatar_url")
        .in("id", followingIds);

      setFriends(profiles?.map(p => ({
        id: p.id!,
        username: p.username!,
        avatar_url: p.avatar_url
      })) || []);
    };

    fetchFriends();
  }, [user]);

  // Fetch messages when chat is active
  useEffect(() => {
    if (!user || !activeChat) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("direct_messages")
        .select("id, content, sender_id, created_at")
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${activeChat.id}),and(sender_id.eq.${activeChat.id},receiver_id.eq.${user.id})`)
        .order("created_at", { ascending: true });

      setMessages(data || []);

      // Mark messages as read
      await supabase
        .from("direct_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("sender_id", activeChat.id)
        .eq("receiver_id", user.id)
        .is("read_at", null);
    };

    fetchMessages();

    const channel = supabase
      .channel(`chat-${activeChat.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
        },
        (payload) => {
          const msg = payload.new as Message & { sender_id: string; receiver_id: string };
          if (
            (msg.sender_id === user.id && msg.receiver_id === activeChat.id) ||
            (msg.sender_id === activeChat.id && msg.receiver_id === user.id)
          ) {
            setMessages(prev => [...prev, { id: msg.id, content: msg.content, sender_id: msg.sender_id, created_at: msg.created_at }]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, activeChat]);

  const openChat = (id: string, name: string, avatar: string | null) => {
    setActiveChat({ id, name, avatar });
    setActiveTab("chat");
  };

  const handleSendMessage = async () => {
    if (!user || !activeChat || !newMessage.trim() || sendingMessage) return;

    setSendingMessage(true);
    try {
      await supabase.from("direct_messages").insert({
        sender_id: user.id,
        receiver_id: activeChat.id,
        content: newMessage.trim(),
      });
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSendingMessage(false);
    }
  };

  // Audio recording handlers
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      
      const chunks: Blob[] = [];
      const startTime = Date.now();
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      recorder.onstop = async () => {
        const duration = Math.floor((Date.now() - startTime) / 1000);
        const blob = new Blob(chunks, { type: recorder.mimeType });
        stream.getTracks().forEach(track => track.stop());
        
        // Upload and send audio
        if (user && activeChat) {
          setSendingMessage(true);
          try {
            const filename = `${user.id}/${Date.now()}.webm`;
            const { error: uploadError } = await supabase.storage
              .from("chat-media")
              .upload(filename, blob, { contentType: "audio/webm" });
            
            if (uploadError) throw uploadError;
            
            const { data: urlData } = supabase.storage
              .from("chat-media")
              .getPublicUrl(filename);
            
            await supabase.from("direct_messages").insert({
              sender_id: user.id,
              receiver_id: activeChat.id,
              content: `🎤 Áudio (${duration}s)`,
              message_type: "audio",
              metadata: { file_url: urlData.publicUrl, duration }
            });
          } catch (error) {
            console.error("Audio upload error:", error);
          } finally {
            setSendingMessage(false);
          }
        }
        
        setRecordingDuration(0);
      };
      
      recorder.start(100);
      setMediaRecorder(recorder);
      setIsRecording(true);
      
      // Timer for duration display
      const interval = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 100);
      
      recorder.addEventListener("stop", () => clearInterval(interval));
      
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  }, [user, activeChat]);

  const stopRecording = useCallback(() => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setMediaRecorder(null);
      setIsRecording(false);
    }
  }, [mediaRecorder, isRecording]);

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
          "bg-card border border-border shadow-xl hover:bg-muted",
          "hover:scale-105 active:scale-95",
          "transition-all duration-500 ease-out",
          isVisible 
            ? "opacity-100 translate-y-0" 
            : "opacity-0 translate-y-8"
        )}
      >
        <MessageCircle className="h-5 w-5 text-foreground" />
        <span className="text-sm font-medium text-foreground hidden sm:inline">
          {t.chat?.messages || "Mensagens"}
        </span>
        {unreadTotal > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
            {unreadTotal > 9 ? "9+" : unreadTotal}
          </span>
        )}
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
        <Card className="fixed bottom-20 right-6 w-80 sm:w-96 max-h-[500px] z-50 shadow-2xl border-border overflow-hidden flex flex-col">
          <CardHeader className="py-3 px-4 border-b border-border flex flex-row items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              {activeTab === "chat" && activeChat && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => {
                    setActiveTab("conversas");
                    setActiveChat(null);
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <CardTitle className="text-base font-semibold">
                {activeTab === "chat" && activeChat 
                  ? activeChat.name 
                  : activeTab === "amigos" 
                    ? (t.chat?.friends || "Amigos")
                    : (t.chat?.conversations || "Conversas")}
              </CardTitle>
            </div>
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

          {/* Tab Navigation - Only show when not in chat view */}
          {activeTab !== "chat" && (
            <div className="flex border-b border-border shrink-0">
              <button
                onClick={() => setActiveTab("conversas")}
                className={cn(
                  "flex-1 py-2 text-sm font-medium transition-colors",
                  activeTab === "conversas" 
                    ? "text-primary border-b-2 border-primary" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.chat?.conversations || "Conversas"}
              </button>
              <button
                onClick={() => setActiveTab("amigos")}
                className={cn(
                  "flex-1 py-2 text-sm font-medium transition-colors",
                  activeTab === "amigos" 
                    ? "text-primary border-b-2 border-primary" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.chat?.friends || "Amigos"}
              </button>
            </div>
          )}

          <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
            {/* Conversas Tab */}
            {activeTab === "conversas" && (
              <>
                {conversations.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">
                    <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">{t.chat?.noConversations || "Nenhuma conversa"}</p>
                    <p className="text-xs mt-1">
                      {t.chat?.startConversation || "Acesse o perfil de um usuário para iniciar"}
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-[350px]">
                    {conversations.map((conv) => {
                      const isOnline = onlineUsers.has(conv.recipientId);
                      return (
                        <button
                          key={conv.id}
                          className="w-full p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left border-b border-border/50"
                          onClick={() => openChat(conv.recipientId, conv.recipientName, conv.recipientAvatar)}
                        >
                          <div className="relative">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={conv.recipientAvatar || undefined} />
                              <AvatarFallback>
                                {conv.recipientName.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {/* Online indicator */}
                            <span 
                              className={cn(
                                "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card",
                                isOnline ? "bg-green-500" : "bg-muted-foreground/50"
                              )}
                            />
                          </div>
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
                      );
                    })}
                  </ScrollArea>
                )}
              </>
            )}

            {/* Amigos Tab */}
            {activeTab === "amigos" && (
              <>
                {friends.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">{t.chat?.noFriends || "Nenhum amigo"}</p>
                    <p className="text-xs mt-1">
                      {t.chat?.followToAdd || "Siga usuários para adicioná-los à sua lista"}
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-[350px]">
                    {friends.map((friend) => {
                      const isOnline = onlineUsers.has(friend.id);
                      return (
                        <button
                          key={friend.id}
                          className="w-full p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left border-b border-border/50"
                          onClick={() => openChat(friend.id, friend.username, friend.avatar_url)}
                        >
                          <div className="relative">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={friend.avatar_url || undefined} />
                              <AvatarFallback>
                                {friend.username.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {/* Online/Offline indicator */}
                            <span 
                              className={cn(
                                "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card",
                                isOnline ? "bg-green-500" : "bg-muted-foreground/50"
                              )}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-sm truncate block">
                              {friend.username}
                            </span>
                            <span className={cn(
                              "text-xs",
                              isOnline ? "text-green-500" : "text-muted-foreground"
                            )}>
                              {isOnline ? "Online" : "Offline"}
                            </span>
                          </div>
                          <MessageCircle className="h-4 w-4 text-muted-foreground" />
                        </button>
                      );
                    })}
                  </ScrollArea>
                )}
              </>
            )}

            {/* Chat View */}
            {activeTab === "chat" && activeChat && (
              <div className="flex flex-col h-[400px]">
                <ScrollArea className="flex-1 p-3">
                  {messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                      {t.chat?.startChat || "Inicie uma conversa"}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            "max-w-[80%] p-2 rounded-lg text-sm",
                            msg.sender_id === user.id
                              ? "ml-auto bg-primary text-primary-foreground"
                              : "bg-muted"
                          )}
                        >
                          {msg.content}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                <div className="p-3 border-t border-border flex gap-2 items-center">
                  {isRecording ? (
                    <>
                      {/* Recording indicator */}
                      <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-destructive/10 rounded-md">
                        <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
                        <span className="text-xs font-mono text-destructive">
                          {formatRecordingTime(recordingDuration)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t.chat?.recording || "Gravando..."}
                        </span>
                      </div>
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={stopRecording}
                        title={t.chat?.stopRecording || "Parar gravação"}
                      >
                        <Square className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      {/* Emoji picker - left of input */}
                      <EmojiPicker 
                        onEmojiSelect={(emoji) => setNewMessage(prev => prev + emoji)}
                        disabled={sendingMessage}
                      />
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={t.chat?.typeMessage || "Digite uma mensagem..."}
                        className="flex-1"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                      />
                      {/* Mic button */}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={startRecording}
                        disabled={sendingMessage}
                        title={t.chat?.recordAudio || "Gravar áudio"}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        {sendingMessage ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Mic className="h-4 w-4" />
                        )}
                      </Button>
                      {/* Send button */}
                      <Button
                        size="icon"
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim() || sendingMessage}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
};

export default GlobalChatButton;
