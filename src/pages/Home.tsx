import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import LivePreviewCard from "@/components/LivePreviewCard";
import UserSearchAutocomplete from "@/components/UserSearchAutocomplete";
import { Video } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api, ApiError, LiveSummary } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

const Home = () => {
  const [lives, setLives] = useState<LiveSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    fetchLives();
  }, []);

  const fetchLives = async () => {
    try {
      const response = await api.lives.getPublic();
      setLives(response.lives ?? []);
    } catch (err: unknown) {
      console.error("Error fetching lives:", err);
      setLives([]);
    } finally {
      setLoading(false);
    }
  };

  const onlineLives = lives.filter((live) => live.status !== "ended");
  const offlineLives = lives.filter((live) => live.status === "ended");

  const handleUserSelect = (selectedUser: { id: string; username: string }) => {
    navigate(`/profile/${selectedUser.username}`);
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <div className="max-w-lg mx-auto">
            <UserSearchAutocomplete 
              onSelectUser={handleUserSelect}
              placeholder={t.home.search}
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading lives...</p>
          </div>
        ) : (
          <>
            {onlineLives.length > 0 && (
              <section className="mb-12">
                <h2 className="text-2xl font-bold mb-6 text-primary flex items-center gap-2">
                  <span className="w-3 h-3 bg-success rounded-full animate-pulse"></span>
                  {t.home.onlineNow}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {onlineLives.map((live) => (
                    <LivePreviewCard
                      key={live.id}
                      live={live}
                      isLoggedIn={!!user}
                      onLoginRequired={() => setShowLoginDialog(true)}
                    />
                  ))}
                </div>
              </section>
            )}

            {offlineLives.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold mb-6 text-muted-foreground">
                  {t.home.offline}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {offlineLives.map((live) => (
                    <LivePreviewCard
                      key={live.id}
                      live={live}
                      isLoggedIn={!!user}
                      onLoginRequired={() => setShowLoginDialog(true)}
                    />
                  ))}
                </div>
              </section>
            )}

            {lives.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 space-y-6">
                {/* REC indicator with blinking red circle */}
                <div className="flex items-center gap-3">
                  <span 
                    className="w-4 h-4 bg-destructive rounded-full"
                    style={{
                      animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                    }}
                  />
                  <div className="flex items-center gap-2 text-destructive font-bold text-lg">
                    <Video className="h-6 w-6" />
                    <span>REC</span>
                  </div>
                </div>
                
                {/* Friendly empty state message */}
                <div className="text-center space-y-2">
                  <p className="text-xl text-foreground font-medium">
                    Está meio vazio por aqui...
                  </p>
                  <p className="text-muted-foreground">
                    Seja o primeiro a entrar ao vivo!
                  </p>
                </div>

                {/* CTA button for creators */}
                {user && (
                  <Button 
                    onClick={() => navigate("/live-management")}
                    className="mt-4 gap-2"
                  >
                    <Video className="h-4 w-4" />
                    Iniciar transmissão
                  </Button>
                )}
              </div>
            )}
          </>
        )}

      <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
        <DialogContent className="border-primary/20">
          <DialogHeader>
            <DialogTitle className="text-primary">{t.home.loginToWatch}</DialogTitle>
            <DialogDescription>
              Create an account or sign in to watch live streams and interact with creators.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button
              className="flex-1"
              onClick={() => navigate("/auth")}
            >
              {t.home.loginButton}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowLoginDialog(false)}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </AppLayout>
  );
};

export default Home;
