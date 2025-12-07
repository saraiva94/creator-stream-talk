import { ReactNode, useEffect, useState } from "react";
import Navbar from "./Navbar";
import { ChannelsSidebar } from "./ChannelsSidebar";
import { BlockedUserOverlay } from "./BlockedUserOverlay";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface AppLayoutProps {
  children: ReactNode;
  showSidebar?: boolean;
}

interface ProfileStatus {
  status: string | null;
  blocked_reason: string | null;
}

export const AppLayout = ({ children, showSidebar = true }: AppLayoutProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    const fetchUserAndStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("status, blocked_reason")
          .eq("id", user.id)
          .maybeSingle();

        if (profile) {
          const profileData = profile as ProfileStatus;
          if (profileData.status === "banned") {
            setIsBlocked(true);
            setBlockedReason(profileData.blocked_reason);
          }
        }
      }
      setCheckingStatus(false);
    };

    fetchUserAndStatus();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setIsBlocked(false);
        setBlockedReason(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Show blocked overlay if user is banned
  if (isBlocked && user) {
    return <BlockedUserOverlay blockedReason={blockedReason} />;
  }

  // Show loading state while checking status
  if (checkingStatus && user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      {showSidebar && <ChannelsSidebar />}
      <main className={`${showSidebar ? "ml-14 lg:ml-60" : ""} transition-all duration-300`}>
        {children}
      </main>
    </div>
  );
};
