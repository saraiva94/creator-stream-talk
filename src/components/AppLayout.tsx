import { ReactNode, useEffect, useState, useCallback } from "react";
import Navbar from "./Navbar";
import { ChannelsSidebar } from "./ChannelsSidebar";
import { BlockedUserOverlay } from "./BlockedUserOverlay";
import { DirectMessagePanel } from "./chat/DirectMessagePanel";
import { useDirectMessages } from "@/hooks/useDirectMessages";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface AppLayoutProps {
  children: ReactNode;
  showSidebar?: boolean;
}

export const AppLayout = ({ children, showSidebar = true }: AppLayoutProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const { chatOpen, toggleChat, initialRecipient, initialMessage } = useDirectMessages(user);

  // Check user status - extracted to avoid async in callback
  const checkUserStatus = useCallback(async (userId: string) => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("status, blocked_reason")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.status === "banned") {
      setIsBlocked(true);
      setBlockedReason((profile as { blocked_reason?: string | null }).blocked_reason ?? null);
      await supabase.auth.signOut();
    } else {
      setIsBlocked(false);
      setBlockedReason(null);
    }
  }, []);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        // Use setTimeout to defer Supabase calls (prevents deadlock)
        setTimeout(() => {
          checkUserStatus(session.user.id);
        }, 0);
      }
    });

    // Listen for auth changes - NO async operations directly in callback
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Defer Supabase calls with setTimeout to prevent deadlock
        setTimeout(() => {
          checkUserStatus(session.user.id);
        }, 0);
      } else {
        setIsBlocked(false);
        setBlockedReason(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [checkUserStatus]);

  // Show blocked overlay if user is banned
  if (isBlocked) {
    return <BlockedUserOverlay reason={blockedReason} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      {showSidebar && <ChannelsSidebar />}
      <main className={`${showSidebar ? "ml-14 lg:ml-60" : ""} transition-all duration-300`}>
        {children}
      </main>
      
      {/* Direct Message Chat Panel */}
      {user && (
        <DirectMessagePanel
          user={user}
          isOpen={chatOpen}
          onToggle={toggleChat}
          initialRecipientId={initialRecipient}
          initialMessage={initialMessage}
        />
      )}
    </div>
  );
};
