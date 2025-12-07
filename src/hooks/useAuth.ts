import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface ProfileStatus {
  status: string | null;
  blocked_reason: string | null;
}

interface UseAuthResult {
  /** undefined = loading, null = logged out, User = logged in */
  user: User | null | undefined;
  session: Session | null | undefined;
  isLoading: boolean;
  isAdmin: boolean;
  isBlocked: boolean;
  blockedReason: string | null;
}

export const useAuth = (): UseAuthResult => {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const initializedRef = useRef(false);

  const checkAdminStatus = useCallback(async (currentUser: User) => {
    // Check from metadata first
    const rolesFromMeta = (() => {
      const metaRoles = (currentUser.app_metadata?.roles ?? currentUser.user_metadata?.roles) as
        | string[]
        | string
        | null
        | undefined;
      const primaryRole =
        (currentUser.app_metadata?.app_role as string | undefined) ||
        (currentUser.user_metadata?.app_role as string | undefined) ||
        (currentUser.app_metadata?.role as string | undefined) ||
        (currentUser.user_metadata?.role as string | undefined);

      const normalized = new Set<string>();
      if (Array.isArray(metaRoles)) {
        metaRoles.forEach((r) => normalized.add(String(r).toLowerCase()));
      } else if (typeof metaRoles === "string") {
        normalized.add(metaRoles.toLowerCase());
      }
      if (primaryRole) {
        normalized.add(String(primaryRole).toLowerCase());
      }
      return normalized;
    })();

    if (rolesFromMeta.has("admin")) {
      setIsAdmin(true);
      return;
    }

    // Fallback to database check
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", currentUser.id);
    setIsAdmin(data?.some((r) => r.role === "admin") || false);
  }, []);

  const checkBlockedStatus = useCallback(async (currentUser: User) => {
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
      } else {
        setIsBlocked(false);
        setBlockedReason(null);
      }
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      
      if (!newSession?.user) {
        setIsAdmin(false);
        setIsBlocked(false);
        setBlockedReason(null);
      } else {
        // Defer Supabase calls with setTimeout to avoid deadlock
        setTimeout(() => {
          checkAdminStatus(newSession.user);
          checkBlockedStatus(newSession.user);
        }, 0);
      }
    });

    // THEN check for existing session (only once)
    if (!initializedRef.current) {
      initializedRef.current = true;
      
      supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          checkAdminStatus(currentSession.user);
          checkBlockedStatus(currentSession.user);
        }
      });
    }

    return () => subscription.unsubscribe();
  }, [checkAdminStatus, checkBlockedStatus]);

  const isLoading = user === undefined;

  return {
    user,
    session,
    isLoading,
    isAdmin,
    isBlocked,
    blockedReason,
  };
};
