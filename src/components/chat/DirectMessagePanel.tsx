import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MessageCircle, X, Maximize2, Minimize2, Send, ArrowLeft, Search, Radio, Loader2, Smile, Check, CheckCheck, Trash2, Image, MoreVertical, Mic, Square, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/useLanguage";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";


type Conversation = {
  id: string;
  username: string;
  avatar_url: string | null;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isOnline?: boolean;
};

type MessageMetadata = {
  live_id?: string;
  creator_name?: string;
  thumbnail_url?: string;
  image_url?: string;
  audio_url?: string;
  audio_duration?: number;
};

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  message_type: string;
  metadata: MessageMetadata | null;
  created_at: string;
  read_at: string | null;
  deleted?: boolean;
};

interface DirectMessagePanelProps {
  user: User | null;
  isOpen: boolean;
  onToggle: () => void;
  initialRecipientId?: string;
  initialMessage?: string;
}

export const DirectMessagePanel = ({ 
  user, 
  isOpen, 
  onToggle,
  initialRecipientId,
  initialMessage
}: DirectMessagePanelProps) => {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; username: string; avatar_url: string | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<Record<string, number>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Generate pseudo-random waveform bars for visual effect
  const generateWaveformBars = (messageId: string) => {
    const seed = messageId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return Array.from({ length: 20 }, (_, i) => {
      const height = 20 + ((seed * (i + 1) * 7) % 60);
      return height;
    });
  };

  // Initialize notification sound with Web Audio API
  useEffect(() => {
    // We'll use Web Audio API directly instead of an Audio element
    return () => {
      // Cleanup if needed
    };
  }, []);

  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
      console.log('Audio notification not available');
    }
  };

  // Fetch conversations
  useEffect(() => {
    if (!user || !isOpen) return;
    fetchConversations();
  }, [user, isOpen]);

  // Typing indicator presence channel
  useEffect(() => {
    if (!user || !selectedConversation) {
      if (typingChannelRef.current) {
        supabase.removeChannel(typingChannelRef.current);
        typingChannelRef.current = null;
      }
      setPartnerTyping(false);
      return;
    }

    const channelName = `typing:${[user.id, selectedConversation.id].sort().join('-')}`;
    const channel = supabase.channel(channelName);

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const partnerIsTyping = Object.values(state).some((presences: any) =>
          presences.some((p: any) => p.userId === selectedConversation.id && p.typing)
        );
        setPartnerTyping(partnerIsTyping);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ userId: user.id, typing: false });
        }
      });

    typingChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      typingChannelRef.current = null;
    };
  }, [user, selectedConversation?.id]);

  // Broadcast typing status
  const broadcastTyping = (typing: boolean) => {
    if (typingChannelRef.current && user) {
      typingChannelRef.current.track({ userId: user.id, typing });
    }
  };

  // Handle typing with debounce
  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
      broadcastTyping(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      broadcastTyping(false);
    }, 2000);
  };

  // Handle initial recipient
  useEffect(() => {
    if (initialRecipientId && user && isOpen) {
      handleStartConversation(initialRecipientId, initialMessage);
    }
  }, [initialRecipientId, user, isOpen]);

  // Subscribe to new messages
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('direct-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `receiver_id=eq.${user.id}`
        },
        (payload) => {
          const newMsg = payload.new as Message;
          // Play notification sound
          playNotificationSound();
          // Update messages if in active conversation
          if (selectedConversation && 
              (newMsg.sender_id === selectedConversation.id || newMsg.receiver_id === selectedConversation.id)) {
            setMessages(prev => [...prev, newMsg]);
            // Mark as read
            markAsRead(newMsg.id);
          } else {
            // Update unread count
            fetchConversations();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedConversation]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchConversations = async () => {
    if (!user) return;

    // Get all messages where user is sender or receiver
    const { data: allMessages, error } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (error || !allMessages) return;

    // Group by conversation partner
    const conversationMap = new Map<string, { messages: Message[], partnerId: string }>();
    
    allMessages.forEach((msg) => {
      const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      if (!conversationMap.has(partnerId)) {
        conversationMap.set(partnerId, { messages: [], partnerId });
      }
      conversationMap.get(partnerId)!.messages.push(msg as unknown as Message);
    });

    // Get partner profiles
    const partnerIds = Array.from(conversationMap.keys());
    if (partnerIds.length === 0) {
      setConversations([]);
      setUnreadTotal(0);
      return;
    }

    const { data: profiles } = await supabase
      .from('public_profiles')
      .select('id, username, avatar_url')
      .in('id', partnerIds);

    // Check who is streaming
    const { data: streamingCreators } = await supabase
      .from('creator_profiles')
      .select('id, is_streaming')
      .in('id', partnerIds)
      .eq('is_streaming', true);

    const streamingIds = new Set(streamingCreators?.map(c => c.id) || []);

    // Build conversation list
    let totalUnread = 0;
    const convList: Conversation[] = partnerIds.map(partnerId => {
      const conv = conversationMap.get(partnerId)!;
      const profile = profiles?.find(p => p.id === partnerId);
      const lastMsg = conv.messages[0];
      const unread = conv.messages.filter(m => m.receiver_id === user.id && !m.read_at).length;
      totalUnread += unread;

      return {
        id: partnerId,
        username: profile?.username || 'Usuário',
        avatar_url: profile?.avatar_url,
        lastMessage: lastMsg.content,
        lastMessageTime: lastMsg.created_at,
        unreadCount: unread,
        isOnline: streamingIds.has(partnerId)
      };
    });

    // Sort by last message time
    convList.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
    
    setConversations(convList);
    setUnreadTotal(totalUnread);
  };

  const handleStartConversation = async (partnerId: string, message?: string) => {
    // Fetch partner profile
    const { data: profile } = await supabase
      .from('public_profiles')
      .select('id, username, avatar_url')
      .eq('id', partnerId)
      .single();

    if (profile) {
      const conv: Conversation = {
        id: profile.id!,
        username: profile.username!,
        avatar_url: profile.avatar_url,
        lastMessage: '',
        lastMessageTime: new Date().toISOString(),
        unreadCount: 0
      };
      setSelectedConversation(conv);
      
      // Load existing messages
      await loadMessages(partnerId);
      
      // Set initial message if provided
      if (message) {
        setNewMessage(message);
      }
    }
  };

  const loadMessages = async (partnerId: string) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data as unknown as Message[]);
      // Mark unread messages as read
      const unreadIds = data.filter(m => m.receiver_id === user.id && !m.read_at).map(m => m.id);
      if (unreadIds.length > 0) {
        await supabase
          .from('direct_messages')
          .update({ read_at: new Date().toISOString() })
          .in('id', unreadIds);
        fetchConversations();
      }
    }
  };

  const markAsRead = async (messageId: string) => {
    await supabase
      .from('direct_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', messageId);
  };

  const sendMessage = async () => {
    if (!user || !selectedConversation || !newMessage.trim()) return;

    setLoading(true);
    const { error } = await supabase
      .from('direct_messages')
      .insert({
        sender_id: user.id,
        receiver_id: selectedConversation.id,
        content: newMessage.trim(),
        message_type: 'text'
      });

    if (!error) {
      setNewMessage("");
      // Optimistic update
      const newMsg: Message = {
        id: crypto.randomUUID(),
        sender_id: user.id,
        receiver_id: selectedConversation.id,
        content: newMessage.trim(),
        message_type: 'text',
        metadata: null,
        created_at: new Date().toISOString(),
        read_at: null
      };
      setMessages(prev => [...prev, newMsg]);
    }
    setLoading(false);
  };

  const deleteMessage = async (messageId: string) => {
    const { error } = await supabase
      .from('direct_messages')
      .update({ content: '[Mensagem apagada]', message_type: 'deleted' })
      .eq('id', messageId)
      .eq('sender_id', user?.id);

    if (!error) {
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, content: '[Mensagem apagada]', message_type: 'deleted', deleted: true }
          : msg
      ));
      toast.success(t.directMessage.messageDeleted);
    } else {
      toast.error(t.directMessage.deleteError);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !selectedConversation) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast.error(t.directMessage.onlyImages);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t.directMessage.imageTooLarge);
      return;
    }

    setUploadingImage(true);

    try {
      // Upload to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(`dm-images/${fileName}`, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(`dm-images/${fileName}`);

      // Send message with image
      const { error } = await supabase
        .from('direct_messages')
        .insert({
          sender_id: user.id,
          receiver_id: selectedConversation.id,
          content: '📷 Imagem',
          message_type: 'image',
          metadata: { image_url: urlData.publicUrl }
        });

      if (!error) {
        const newMsg: Message = {
          id: crypto.randomUUID(),
          sender_id: user.id,
          receiver_id: selectedConversation.id,
          content: '📷 Imagem',
          message_type: 'image',
          metadata: { image_url: urlData.publicUrl },
          created_at: new Date().toISOString(),
          read_at: null
        };
        setMessages(prev => [...prev, newMsg]);
        toast.success(t.directMessage.imageSent);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(t.directMessage.imageError);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Audio recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await uploadAudio(audioBlob, recordingTime);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 60) {
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error(t.directMessage.microphoneError);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
    setRecordingTime(0);
    audioChunksRef.current = [];
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  };

  const uploadAudio = async (audioBlob: Blob, duration: number) => {
    if (!user || !selectedConversation) return;

    setUploadingAudio(true);

    try {
      const fileName = `${user.id}/${Date.now()}.webm`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(`dm-audio/${fileName}`, audioBlob);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(`dm-audio/${fileName}`);

      const { error } = await supabase
        .from('direct_messages')
        .insert({
          sender_id: user.id,
          receiver_id: selectedConversation.id,
          content: '🎤 Áudio',
          message_type: 'audio',
          metadata: { audio_url: urlData.publicUrl, audio_duration: duration }
        });

      if (!error) {
        const newMsg: Message = {
          id: crypto.randomUUID(),
          sender_id: user.id,
          receiver_id: selectedConversation.id,
          content: '🎤 Áudio',
          message_type: 'audio',
          metadata: { audio_url: urlData.publicUrl, audio_duration: duration },
          created_at: new Date().toISOString(),
          read_at: null
        };
        setMessages(prev => [...prev, newMsg]);
        toast.success(t.directMessage.audioSent);
      }
    } catch (error) {
      console.error('Audio upload error:', error);
      toast.error(t.directMessage.audioError);
    } finally {
      setUploadingAudio(false);
      setRecordingTime(0);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleAudioPlay = (audioUrl: string, messageId: string) => {
    if (playingAudioId === messageId) {
      audioPlayerRef.current?.pause();
      setPlayingAudioId(null);
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      audioPlayerRef.current = new Audio(audioUrl);
      
      audioPlayerRef.current.ontimeupdate = () => {
        if (audioPlayerRef.current) {
          const progress = (audioPlayerRef.current.currentTime / audioPlayerRef.current.duration) * 100;
          setAudioProgress(prev => ({ ...prev, [messageId]: progress }));
        }
      };
      
      audioPlayerRef.current.onended = () => {
        setPlayingAudioId(null);
        setAudioProgress(prev => ({ ...prev, [messageId]: 0 }));
      };
      
      audioPlayerRef.current.play();
      setPlayingAudioId(messageId);
    }
  };

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const { data } = await supabase
      .from('public_profiles')
      .select('id, username, avatar_url')
      .ilike('username', `%${query}%`)
      .neq('id', user?.id)
      .limit(10);

    setSearchResults(data || []);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t.directMessage.now;
    if (minutes < 60) return `${minutes}min`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };

  if (!user) return null;

  // Collapsed button with animated unread indicator
  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-card border border-primary/20 rounded-full shadow-lg hover:shadow-xl transition-all hover:border-primary/40 group"
      >
        <div className="relative">
          <MessageCircle className="h-5 w-5 text-primary" />
          {unreadTotal > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
            </span>
          )}
        </div>
        <span className="text-sm font-medium">{t.directMessage.messages}</span>
        {unreadTotal > 0 && (
          <Badge variant="destructive" className="h-5 min-w-5 flex items-center justify-center text-xs animate-pulse">
            {unreadTotal > 9 ? '9+' : unreadTotal}
          </Badge>
        )}
      </button>
    );
  }

  return (
    <div 
      className={cn(
        "fixed z-50 bg-card border border-primary/20 rounded-xl shadow-2xl transition-all duration-300 overflow-hidden flex flex-col",
        isExpanded 
          ? "inset-4 md:inset-8" 
          : "bottom-6 right-6 w-80 h-[480px] md:w-96 md:h-[520px]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-2">
          {selectedConversation && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSelectedConversation(null)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <MessageCircle className="h-5 w-5 text-primary" />
          <span className="font-semibold">
            {selectedConversation ? selectedConversation.username : t.directMessage.messages}
          </span>
          {unreadTotal > 0 && !selectedConversation && (
            <Badge variant="secondary" className="text-xs">{unreadTotal}</Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onToggle}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {!selectedConversation ? (
        // Conversation List
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t.directMessage.searchUser}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  searchUsers(e.target.value);
                }}
                className="pl-9 h-9"
              />
            </div>
          </div>

          {/* Search Results or Conversations */}
          <ScrollArea className="flex-1">
            {searchQuery ? (
              <div className="p-2">
                {searchResults.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-4">
                    {t.directMessage.noUserFound}
                  </p>
                ) : (
                  searchResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => {
                        handleStartConversation(user.id!);
                        setSearchQuery("");
                        setSearchResults([]);
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback>{user.username?.[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{user.username}</span>
                    </button>
                  ))
                )}
              </div>
            ) : (
              <div className="p-2">
                {conversations.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    {t.directMessage.noConversations}
                  </p>
                ) : (
                  conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => {
                        setSelectedConversation(conv);
                        loadMessages(conv.id);
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="relative">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={conv.avatar_url || undefined} />
                          <AvatarFallback>{conv.username?.[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        {conv.isOnline && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-destructive rounded-full border-2 border-card flex items-center justify-center">
                            <Radio className="h-2.5 w-2.5 text-white" />
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between">
                          <span className="font-medium truncate">{conv.username}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(conv.lastMessageTime)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {conv.lastMessage}
                        </p>
                      </div>
                      {conv.unreadCount > 0 && (
                        <Badge variant="destructive" className="h-5 min-w-5 flex items-center justify-center text-xs">
                          {conv.unreadCount}
                        </Badge>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      ) : (
        // Message View
        <div className="flex-1 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 p-3">
            <div className="space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex group",
                    msg.sender_id === user.id ? "justify-end" : "justify-start"
                  )}
                >
                  {/* Delete menu for own messages */}
                  {msg.sender_id === user.id && msg.message_type !== 'deleted' && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity self-center mr-1"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => deleteMessage(msg.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t.directMessage.deleteMessage}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-4 py-2",
                      msg.sender_id === user.id
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted rounded-bl-sm",
                      msg.message_type === 'deleted' && "opacity-60 italic"
                    )}
                  >
                    {msg.message_type === 'deleted' ? (
                      <p className="text-sm italic">{msg.content}</p>
                    ) : msg.message_type === 'audio' && msg.metadata?.audio_url ? (
                      <div className="flex items-center gap-3 min-w-[180px]">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-10 w-10 shrink-0 rounded-full",
                            msg.sender_id === user.id 
                              ? "bg-primary-foreground/20 hover:bg-primary-foreground/30"
                              : "bg-muted-foreground/20 hover:bg-muted-foreground/30"
                          )}
                          onClick={() => toggleAudioPlay(msg.metadata!.audio_url!, msg.id)}
                        >
                          {playingAudioId === msg.id ? (
                            <Pause className="h-5 w-5" />
                          ) : (
                            <Play className="h-5 w-5 ml-0.5" />
                          )}
                        </Button>
                        <div className="flex-1 flex flex-col gap-1">
                          {/* Waveform visualization */}
                          <div className="flex items-center gap-[2px] h-8">
                            {generateWaveformBars(msg.id).map((height, i) => {
                              const progress = audioProgress[msg.id] || 0;
                              const barProgress = (i / 20) * 100;
                              const isActive = barProgress < progress;
                              const isPlaying = playingAudioId === msg.id;
                              
                              return (
                                <div
                                  key={i}
                                  className={cn(
                                    "w-1 rounded-full transition-all duration-150",
                                    msg.sender_id === user.id
                                      ? isActive || !isPlaying
                                        ? "bg-primary-foreground"
                                        : "bg-primary-foreground/30"
                                      : isActive || !isPlaying
                                        ? "bg-foreground"
                                        : "bg-muted-foreground/30",
                                    isPlaying && isActive && "animate-pulse"
                                  )}
                                  style={{ 
                                    height: `${height}%`,
                                    opacity: isPlaying ? (isActive ? 1 : 0.4) : 0.7
                                  }}
                                />
                              );
                            })}
                          </div>
                          <span className={cn(
                            "text-[10px]",
                            msg.sender_id === user.id ? "text-primary-foreground/70" : "text-muted-foreground"
                          )}>
                            {formatDuration(msg.metadata.audio_duration || 0)}
                          </span>
                        </div>
                      </div>
                    ) : msg.message_type === 'image' && msg.metadata?.image_url ? (
                      <div>
                        <img 
                          src={msg.metadata.image_url} 
                          alt="Imagem" 
                          className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(msg.metadata?.image_url, '_blank')}
                        />
                      </div>
                    ) : msg.message_type === 'live_share' && msg.metadata ? (
                      <a 
                        href={`/live/${msg.metadata.live_id}`}
                        className="block"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Radio className="h-4 w-4 text-destructive" />
                          <span className="text-sm font-medium">Live de {String(msg.metadata.creator_name || '')}</span>
                        </div>
                        <p className="text-sm opacity-90">{msg.content}</p>
                      </a>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    )}
                    <div className={cn(
                      "flex items-center gap-1 mt-1",
                      msg.sender_id === user.id ? "justify-end" : "justify-start"
                    )}>
                      <span className={cn(
                        "text-[10px]",
                        msg.sender_id === user.id ? "text-primary-foreground/70" : "text-muted-foreground"
                      )}>
                        {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {msg.sender_id === user.id && msg.message_type !== 'deleted' && (
                        msg.read_at ? (
                          <CheckCheck className="h-3.5 w-3.5 text-primary-foreground/90" />
                        ) : (
                          <Check className="h-3.5 w-3.5 text-primary-foreground/50" />
                        )
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Typing indicator */}
              {partnerTyping && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Message Input */}
          <div className="p-3 border-t border-border/50">
            <form 
              onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
              className="flex gap-2 items-center"
            >
              <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                <PopoverTrigger asChild>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 shrink-0"
                  >
                    <Smile className="h-5 w-5 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  side="top" 
                  align="start" 
                  className="w-64 p-2"
                >
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    Emoji picker temporarily disabled
                  </div>
                </PopoverContent>
              </Popover>
              
              {/* Image upload button */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <Button 
                type="button" 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 shrink-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <Image className="h-5 w-5 text-muted-foreground" />
                )}
              </Button>
              
              {/* Audio recording button */}
              {isRecording ? (
                <div className="flex items-center gap-2 flex-1 bg-destructive/10 rounded-lg px-3 py-2">
                  <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                  <span className="text-sm font-medium text-destructive">{formatDuration(recordingTime)}</span>
                  <span className="text-xs text-muted-foreground">{t.directMessage.maxOneMin}</span>
                  <div className="flex-1" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={cancelRecording}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    size="icon"
                    className="h-8 w-8"
                    onClick={stopRecording}
                    disabled={uploadingAudio}
                  >
                    {uploadingAudio ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ) : (
                <>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 shrink-0"
                    onClick={startRecording}
                    disabled={uploadingImage || uploadingAudio}
                  >
                    <Mic className="h-5 w-5 text-muted-foreground" />
                  </Button>
                  
                  <Input
                    ref={inputRef}
                    placeholder={t.directMessage.typePlaceholder}
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      handleTyping();
                    }}
                    className="flex-1"
                    disabled={loading || uploadingImage || uploadingAudio}
                  />
                  <Button type="submit" size="icon" disabled={loading || uploadingImage || uploadingAudio || !newMessage.trim()}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DirectMessagePanel;
