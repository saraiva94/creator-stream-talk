import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { User, Session, AuthError } from "@supabase/supabase-js";

interface ProfileStatus {
  status: string | null;
  blocked_reason: string | null;
}

interface AuthContextType {
  /** undefined = loading, null = logged out, User = logged in */
  user: User | null | undefined;
  session: Session | null | undefined;
  isLoading: boolean;
  isAdmin: boolean;
  isAdminLoading: boolean;
  isBlocked: boolean;
  blockedReason: string | null;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const initializedRef = useRef(false);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const checkAdminStatus = useCallback(async (currentUser: User) => {
    setIsAdminLoading(true);
    try {
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
        setIsAdminLoading(false);
        return;
      }

      // Fallback to database check
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", currentUser.id);
      setIsAdmin(data?.some((r) => r.role === "admin") || false);
    } finally {
      setIsAdminLoading(false);
    }
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

  const handleSessionExpired = useCallback(() => {
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    setIsBlocked(false);
    setBlockedReason(null);
    
    toast({
      title: "Sessão expirada",
      description: "Por favor, faça login novamente.",
      variant: "destructive",
    });
  }, [toast]);

  const refreshSession = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error("Failed to refresh session:", error.message);
        
        // Handle specific error cases
        if (error.message.includes("refresh_token") || error.message.includes("expired")) {
          handleSessionExpired();
        }
        return;
      }

      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
      }
    } catch (err) {
      console.error("Error refreshing session:", err);
    }
  }, [handleSessionExpired]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Erro ao sair",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    setIsBlocked(false);
    setBlockedReason(null);
    
    toast({
      title: "Até logo!",
      description: "Você foi desconectado.",
    });
  }, [toast]);

  // Set up automatic token refresh (every 10 minutes)
  useEffect(() => {
    if (session) {
      // Clear any existing interval
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }

      // Set up new interval (10 minutes = 600000ms)
      refreshIntervalRef.current = setInterval(() => {
        refreshSession();
      }, 600000);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [session, refreshSession]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      // Handle specific auth events
      if (event === "TOKEN_REFRESHED") {
        console.log("Token refreshed successfully");
      }
      
      if (event === "SIGNED_OUT") {
        setUser(null);
        setSession(null);
        setIsAdmin(false);
        setIsBlocked(false);
        setBlockedReason(null);
        return;
      }

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
      
      supabase.auth.getSession().then(({ data: { session: currentSession }, error }) => {
        if (error) {
          console.error("Error getting session:", error.message);
          
          // Handle expired session
          if (error.message.includes("expired") || error.message.includes("invalid")) {
            handleSessionExpired();
            return;
          }
        }

        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          checkAdminStatus(currentSession.user);
          checkBlockedStatus(currentSession.user);
        }
      });
    }

    return () => {
      subscription.unsubscribe();
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [checkAdminStatus, checkBlockedStatus, handleSessionExpired]);

  const isLoading = user === undefined;

  const value: AuthContextType = {
    user,
    session,
    isLoading,
    isAdmin,
    isAdminLoading,
    isBlocked,
    blockedReason,
    refreshSession,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
