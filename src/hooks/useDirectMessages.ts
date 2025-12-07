import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export const useDirectMessages = (user: User | null) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [initialRecipient, setInitialRecipient] = useState<string | undefined>();
  const [initialMessage, setInitialMessage] = useState<string | undefined>();

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const { count, error } = await supabase
      .from('direct_messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .is('read_at', null);

    if (!error) {
      setUnreadCount(count || 0);
    }
  }, [user]);

  // Subscribe to new messages
  useEffect(() => {
    if (!user) return;

    fetchUnreadCount();

    const channel = supabase
      .channel('dm-unread-count')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `receiver_id=eq.${user.id}`
        },
        () => {
          if (!chatOpen) {
            setUnreadCount(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, chatOpen, fetchUnreadCount]);

  const openChatWithUser = useCallback((userId: string, message?: string) => {
    setInitialRecipient(userId);
    setInitialMessage(message);
    setChatOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setChatOpen(false);
    setInitialRecipient(undefined);
    setInitialMessage(undefined);
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  const toggleChat = useCallback(() => {
    if (chatOpen) {
      closeChat();
    } else {
      setChatOpen(true);
    }
  }, [chatOpen, closeChat]);

  return {
    unreadCount,
    chatOpen,
    setChatOpen,
    initialRecipient,
    initialMessage,
    openChatWithUser,
    closeChat,
    toggleChat,
    refreshUnreadCount: fetchUnreadCount
  };
};

export default useDirectMessages;
