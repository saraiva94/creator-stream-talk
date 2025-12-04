import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, User, Shield, Home, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LanguageSelector } from "./LanguageSelector";
import { useLanguage } from "@/hooks/useLanguage";
import { useState, useEffect, useCallback } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { StreamStarLogo } from "./StreamStarLogo";
import { TransmitButton } from "./TransmitButton";

interface NavbarProps {
  user?: SupabaseUser | null;
}

const Navbar = ({ user }: NavbarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isAdmin, setIsAdmin] = useState(false);

  const checkAdminStatus = useCallback(async () => {
    if (!user) return;

    const rolesFromMeta = (() => {
      const metaRoles = (user.app_metadata?.roles ?? user.user_metadata?.roles) as
        | string[]
        | string
        | null
        | undefined;
      const primaryRole =
        (user.app_metadata?.app_role as string | undefined) ||
        (user.user_metadata?.app_role as string | undefined) ||
        (user.app_metadata?.role as string | undefined) ||
        (user.user_metadata?.role as string | undefined);

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

    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    setIsAdmin(data?.some((r) => r.role === "admin") || false);
  }, [user]);

  useEffect(() => {
    if (user) {
      checkAdminStatus();
    }
  }, [user, checkAdminStatus]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error signing out",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Goodbye!",
      description: "You have been signed out.",
    });
    navigate("/auth");
  };

  return (
    <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="hover:opacity-80 transition-opacity">
              <StreamStarLogo />
            </Link>
            <TransmitButton user={user ?? null} />
          </div>

          <div className="flex items-center gap-4">
            <LanguageSelector />
            {user ? (
              <>
                {isAdmin && (
                  <Link to="/admin">
                    <Button variant="ghost" size="sm">
                      <Shield className="h-4 w-4 mr-2" />
                      {t.nav.admin}
                    </Button>
                  </Link>
                )}
                {location.pathname !== "/" && (
                  <Link to="/">
                    <Button variant="ghost" size="sm">
                      <Home className="h-4 w-4 mr-2" />
                      {t.nav.home}
                    </Button>
                  </Link>
                )}
                <Link to="/profile">
                  <Button variant="ghost" size="sm">
                    <User className="h-4 w-4 mr-2" />
                    {t.nav.profile}
                  </Button>
                </Link>
                <Link to="/affiliate">
                  <Button variant="ghost" size="sm">
                    <DollarSign className="h-4 w-4 mr-2" />
                    {t.nav.affiliates}
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  {t.nav.logout}
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                {location.pathname !== "/" && (
                  <Link to="/">
                    <Button variant="ghost" size="sm">
                      <Home className="h-4 w-4 mr-2" />
                      {t.nav.home}
                    </Button>
                  </Link>
                )}
                <Link to="/auth">
                  <Button variant="outline" size="sm">
                    {t.nav.login}
                  </Button>
                </Link>
                <Link to="/subscribe">
                  <Button size="sm">{t.subscribe.subscribeNow}</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
