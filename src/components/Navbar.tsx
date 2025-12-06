import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, User, Shield, Home, DollarSign, Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LanguageSelector } from "./LanguageSelector";
import { useLanguage } from "@/hooks/useLanguage";
import { useState, useEffect, useCallback } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { StreamStarLogo } from "./StreamStarLogo";
import { TransmitButton } from "./TransmitButton";
import { NotificationBell } from "./NotificationBell";
import { InstallPWAButton } from "./InstallPWAButton";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface NavbarProps {
  user?: SupabaseUser | null;
}

const Navbar = ({ user }: NavbarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    setMobileMenuOpen(false);
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

  const closeMobileMenu = () => setMobileMenuOpen(false);

  // Mobile menu content
  const MobileMenuContent = () => (
    <div className="flex flex-col gap-2 pt-4">
      <div className="pb-4 border-b border-border mb-2">
        <LanguageSelector />
      </div>
      
      {user && <NotificationBell user={user} />}
      
      <TransmitButton user={user ?? null} />
      
      <InstallPWAButton />
      
      {user ? (
        <>
          {isAdmin && (
            <Link to="/admin" onClick={closeMobileMenu}>
              <Button variant="ghost" className="w-full justify-start">
                <Shield className="h-4 w-4 mr-2" />
                {t.nav.admin}
              </Button>
            </Link>
          )}
          {location.pathname !== "/" && (
            <Link to="/" onClick={closeMobileMenu}>
              <Button variant="ghost" className="w-full justify-start">
                <Home className="h-4 w-4 mr-2" />
                {t.nav.home}
              </Button>
            </Link>
          )}
          <Link to="/profile" onClick={closeMobileMenu}>
            <Button variant="ghost" className="w-full justify-start">
              <User className="h-4 w-4 mr-2" />
              {t.nav.profile}
            </Button>
          </Link>
          <Link to="/affiliate" onClick={closeMobileMenu}>
            <Button variant="ghost" className="w-full justify-start">
              <DollarSign className="h-4 w-4 mr-2" />
              {t.nav.finances}
            </Button>
          </Link>
          <Button variant="ghost" className="w-full justify-start text-destructive" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            {t.nav.logout}
          </Button>
        </>
      ) : (
        <div className="flex flex-col gap-2 pt-2">
          {location.pathname !== "/" && (
            <Link to="/" onClick={closeMobileMenu}>
              <Button variant="ghost" className="w-full justify-start">
                <Home className="h-4 w-4 mr-2" />
                {t.nav.home}
              </Button>
            </Link>
          )}
          <Link to="/auth" onClick={closeMobileMenu}>
            <Button variant="outline" className="w-full">
              {t.nav.login}
            </Button>
          </Link>
          <Link to="/subscribe" onClick={closeMobileMenu}>
            <Button className="w-full">{t.subscribe.subscribeNow}</Button>
          </Link>
        </div>
      )}
    </div>
  );

  return (
    <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo - always visible */}
          <div className="flex items-center gap-4">
            <Link to="/" className="hover:opacity-80 transition-opacity">
              <StreamStarLogo />
            </Link>
            {/* TransmitButton hidden on mobile */}
            <div className="hidden md:block">
              <TransmitButton user={user ?? null} />
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4">
            <InstallPWAButton />
            <LanguageSelector />
            {user && <NotificationBell user={user} />}
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
                    {t.nav.finances}
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

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <StreamStarLogo />
                </div>
                <MobileMenuContent />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
