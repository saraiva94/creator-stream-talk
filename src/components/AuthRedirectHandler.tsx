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
    const currentPath = location.pathname;
    
    console.log("[AUTH_REDIRECT] Checking hash on path:", currentPath, "hash:", hash?.substring(0, 50) + "...");
    
    // If we're already on update-password, don't redirect (let the page handle it)
    if (currentPath === "/update-password") {
      console.log("[AUTH_REDIRECT] Already on update-password, skipping redirect");
      return;
    }
    
    // Check if hash contains recovery tokens
    if (hash && hash.includes("type=recovery")) {
      console.log("[AUTH_REDIRECT] Recovery token detected in URL hash, redirecting to /update-password");
      // Navigate to update-password, keeping the hash for the page to process
      navigate("/update-password" + hash, { replace: true });
      return;
    }

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[AUTH_REDIRECT] Auth state changed:", event);
      
      // Only redirect if we're not already on update-password
      if (event === "PASSWORD_RECOVERY" && currentPath !== "/update-password") {
        console.log("[AUTH_REDIRECT] PASSWORD_RECOVERY event detected, redirecting to /update-password");
        navigate("/update-password", { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, location.pathname]);

  return null;
};

