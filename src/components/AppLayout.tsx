import { ReactNode, useEffect, useState, useRef } from "react";
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
  // undefined = ainda verificando, null = deslogado, User = logado
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const initializedRef = useRef(false);

  useEffect(() => {
    // Configura o listener de auth PRIMEIRO
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setIsBlocked(false);
        setBlockedReason(null);
        setCheckingStatus(false);
      }
    });

    // DEPOIS verifica a sessão existente (apenas uma vez)
    if (!initializedRef.current) {
      initializedRef.current = true;
      
      const fetchUserAndStatus = async () => {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        setUser(currentUser ?? null);

        if (currentUser) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("status, blocked_reason")
            .eq("id", currentUser.id)
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
    }

    return () => subscription.unsubscribe();
  }, []);

  // Show blocked overlay if user is banned
  if (isBlocked && user) {
    return <BlockedUserOverlay blockedReason={blockedReason} />;
  }

  // Show loading state while checking auth (user === undefined means still checking)
  if (user === undefined || (checkingStatus && user)) {
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
