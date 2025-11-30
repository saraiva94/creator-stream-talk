import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import LivePreviewCard from "@/components/LivePreviewCard";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api, LiveSummary } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";

const Home = () => {
  const [lives, setLives] = useState<LiveSummary[]>([]);
  const [filteredLives, setFilteredLives] = useState<LiveSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
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

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredLives(lives);
    } else {
      const filtered = lives.filter((live) => {
        const haystack = `${live.title ?? ""} ${live.description ?? ""}`.toLowerCase();
        return haystack.includes(searchQuery.toLowerCase());
      });
      setFilteredLives(filtered);
    }
  }, [searchQuery, lives]);

  const fetchLives = async () => {
    try {
      const response = await api.lives.getPublic();
      setLives(response.lives ?? []);
      setFilteredLives(response.lives ?? []);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching lives:", err);
      setError("Failed to load live sessions");
    } finally {
      setLoading(false);
    }
  };

  const onlineLives = filteredLives.filter((live) => live.status !== "ended");
  const offlineLives = filteredLives.filter((live) => live.status === "ended");

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-bold mb-4 text-primary">
            {t.home.title}
          </h1>
          <p className="text-xl text-muted-foreground mb-6">
            {t.home.subtitle}
          </p>
          
          <div className="max-w-md mx-auto relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t.home.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-card border-primary/20 focus:border-primary"
            />
          </div>
        </div>

        {error && (
          <div className="text-center text-destructive mb-6">{error}</div>
        )}

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

            {filteredLives.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-lg">{t.home.noCreators}</p>
              </div>
            )}
          </>
        )}
      </main>

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
  );
};

export default Home;
