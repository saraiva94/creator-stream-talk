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

export const AppLayout = ({ children, showSidebar = true }: AppLayoutProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    const fetchUserAndCheckStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("status")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.status === "banned") {
          setIsBlocked(true);
          await supabase.auth.signOut();
        }
      }
    };
    fetchUserAndCheckStatus();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("status")
          .eq("id", session.user.id)
          .maybeSingle();

        if (profile?.status === "banned") {
          setIsBlocked(true);
          await supabase.auth.signOut();
        } else {
          setIsBlocked(false);
        }
      } else {
        setIsBlocked(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Show blocked overlay if user is banned
  if (isBlocked) {
    return <BlockedUserOverlay />;
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
