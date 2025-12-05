import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * Handles auth redirects, especially for password recovery tokens in URL hash.
 * Must be placed inside BrowserRouter.
 */
export const AuthRedirectHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check for recovery token in URL hash on mount
    const hash = window.location.hash;
    if (hash && hash.includes("type=recovery")) {
      console.log("[AUTH] Recovery token detected in URL hash, redirecting to /update-password");
      // Navigate to update-password, keeping the hash for Supabase to process
      navigate("/update-password" + hash, { replace: true });
      return;
    }

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[AUTH] Auth state changed:", event);
      
      if (event === "PASSWORD_RECOVERY") {
        console.log("[AUTH] PASSWORD_RECOVERY event detected, redirecting to /update-password");
        navigate("/update-password", { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return null;
};

