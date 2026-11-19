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
    const currentPath = location.pathname;

    const search = window.location.search || "";
    const hash = window.location.hash || "";
    const isSignupReturn = currentPath === "/subscribe" &&
      new URLSearchParams(search).get("flow") === "signup" && !hash.includes("type=recovery");

    // Detect recovery by hash (implicit) OR by query (PKCE)
    const hasRecoveryInHash =
      hash.includes("type=recovery") || hash.includes("access_token=") || hash.includes("refresh_token=");
    const hasCodeInQuery = new URLSearchParams(search).has("code");

    // If already on /update-password, skip redirect (let the page process tokens/code)
    if (currentPath === "/update-password") {
      return;
    }

    // If recovery detected outside the page, redirect preserving search + hash
    if (!isSignupReturn && (hasRecoveryInHash || hasCodeInQuery)) {
      navigate(`/update-password${search}${hash}`, { replace: true });
      return;
    }

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        // Preserve whatever exists (may be code or hash)
        const s = window.location.search || "";
        const h = window.location.hash || "";
        navigate(`/update-password${s}${h}`, { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, location.pathname]);

  return null;
};
