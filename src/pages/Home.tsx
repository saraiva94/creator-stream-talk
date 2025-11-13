import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import CreatorCard from "@/components/CreatorCard";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Creator {
  id: string;
  display_name: string;
  bio: string | null;
  is_streaming: boolean;
  viewer_count: number;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
}

const Home = () => {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [filteredCreators, setFilteredCreators] = useState<Creator[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
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
    fetchCreators();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredCreators(creators);
    } else {
      const filtered = creators.filter(creator =>
        creator.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        creator.profiles.username.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredCreators(filtered);
    }
  }, [searchQuery, creators]);

  const fetchCreators = async () => {
    try {
      const { data, error } = await supabase
        .from("creator_profiles")
        .select(`
          id,
          display_name,
          bio,
          is_streaming,
          viewer_count,
          profiles!inner (username, avatar_url)
        `)
        .order("is_streaming", { ascending: false })
        .order("viewer_count", { ascending: false });

      if (error) throw error;
      setCreators(data || []);
      setFilteredCreators(data || []);
    } catch (error) {
      console.error("Error fetching creators:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnterRoom = (creatorId: string) => {
    if (!user) {
      setShowLoginDialog(true);
      return;
    }
    navigate(`/room/${creatorId}`);
  };

  const onlineCreators = filteredCreators.filter(c => c.is_streaming);
  const offlineCreators = filteredCreators.filter(c => !c.is_streaming);

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

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading creators...</p>
          </div>
        ) : (
          <>
            {onlineCreators.length > 0 && (
              <section className="mb-12">
                <h2 className="text-2xl font-bold mb-6 text-primary flex items-center gap-2">
                  <span className="w-3 h-3 bg-success rounded-full animate-pulse"></span>
                  {t.home.onlineNow}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {onlineCreators.map((creator) => (
                    <CreatorCard
                      key={creator.id}
                      creator={creator}
                      onEnter={() => handleEnterRoom(creator.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {offlineCreators.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold mb-6 text-muted-foreground">
                  {t.home.offline}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {offlineCreators.map((creator) => (
                    <CreatorCard
                      key={creator.id}
                      creator={creator}
                      onEnter={() => handleEnterRoom(creator.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {filteredCreators.length === 0 && (
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
