import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export const useBlockedUser = () => {
  const [isBlocked, setIsBlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkBlockedStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setChecking(false);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("status")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.status === "banned") {
          setIsBlocked(true);
          // Sign out the blocked user
          await supabase.auth.signOut();
        }
      } catch (error) {
        console.error("Error checking blocked status:", error);
      } finally {
        setChecking(false);
      }
    };

    checkBlockedStatus();

    // Re-check on auth state change
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
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

  return { isBlocked, checking };
};
