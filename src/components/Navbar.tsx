import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, User, Shield, Home, DollarSign, Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LanguageSelector } from "./LanguageSelector";
import { useLanguage } from "@/hooks/useLanguage";
import { useState } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { StreamStarLogo } from "./StreamStarLogo";
import { TransmitButton } from "./TransmitButton";
import { NotificationBell } from "./NotificationBell";
import { InstallPWAButton } from "./InstallPWAButton";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface NavbarProps {
  user?: SupabaseUser | null | undefined;
  isAdmin?: boolean;
}

const Navbar = ({ user, isAdmin = false }: NavbarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      title: t.common?.goodbye || "Goodbye!",
      description: t.common?.signedOut || "You have been signed out.",
    });
    navigate("/auth");
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  // Mobile menu content - order: Transmitir, Início, Perfil, Finanças, Sair, Admin (last for admins)
  const MobileMenuContent = () => {
    const handleNavigation = (path: string) => {
      closeMobileMenu();
      // Use navigate instead of Link to ensure proper SPA navigation
      navigate(path);
    };

    return (
      <div className="flex flex-col gap-2 pt-4">
        {user ? (
          <>
            {/* Transmitir first */}
            <TransmitButton user={user ?? null} />
            {/* Início second */}
            <Button 
              variant="ghost" 
              className="w-full justify-start"
              onClick={() => handleNavigation("/")}
            >
              <Home className="h-4 w-4 mr-2" />
              {t.nav.home}
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start"
              onClick={() => handleNavigation("/profile")}
            >
              <User className="h-4 w-4 mr-2" />
              {t.nav.profile}
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start"
              onClick={() => handleNavigation("/affiliate")}
            >
              <DollarSign className="h-4 w-4 mr-2" />
              {t.nav.finances}
            </Button>
            {/* Sair before Admin */}
            <Button variant="ghost" className="w-full justify-start text-destructive" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              {t.nav.logout}
            </Button>
            {/* Admin at the very end, only for admins */}
            {isAdmin && (
              <Button 
                variant="ghost" 
                className="w-full justify-start"
                onClick={() => handleNavigation("/admin")}
              >
                <Shield className="h-4 w-4 mr-2" />
                {t.nav.admin}
              </Button>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-2 pt-2">
            <Button 
              variant="ghost" 
              className="w-full justify-start"
              onClick={() => handleNavigation("/")}
            >
              <Home className="h-4 w-4 mr-2" />
              {t.nav.home}
            </Button>
            <div className="py-2">
              <LanguageSelector />
            </div>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => handleNavigation("/auth")}
            >
              {t.nav.login}
            </Button>
            <Button 
              className="w-full"
              onClick={() => handleNavigation("/subscribe")}
            >
              {t.subscribe.subscribeNow}
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <nav className="border-b border-border bg-card/95 backdrop-blur-md fixed top-0 left-0 right-0 z-50">
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
            <LanguageSelector />
            {user && <NotificationBell user={user} showPaymentNotifications={isAdmin} />}
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
          <div className="md:hidden flex items-center gap-1">
            {/* Language selector - always visible on mobile */}
            <LanguageSelector />
            {/* Notification bell in external navbar */}
            {user && <NotificationBell user={user} showPaymentNotifications={isAdmin} />}
            <div className="flex-shrink-0">
              <InstallPWAButton />
            </div>
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent 
                side="right" 
                className="w-56"
                onSwipeClose={() => setMobileMenuOpen(false)}
              >
                <div className="flex items-center justify-between pb-4 border-b border-border animate-fade-in">
                  <StreamStarLogo />
                </div>
                <div className="animate-fade-in" style={{ animationDelay: '0.05s' }}>
                  <MobileMenuContent />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
