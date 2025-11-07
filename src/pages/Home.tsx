import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import CreatorCard from "@/components/CreatorCard";
import Navbar from "@/components/Navbar";
import { Users } from "lucide-react";

interface Creator {
  id: string;
  display_name: string;
  bio?: string;
  tags?: string[];
  is_streaming: boolean;
  viewer_count: number;
  profiles: {
    avatar_url?: string;
  };
}

const Home = () => {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };
    getUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const fetchCreators = async () => {
      const { data, error } = await supabase
        .from("creator_profiles")
        .select(`
          *,
          profiles (avatar_url)
        `)
        .order("is_streaming", { ascending: false })
        .order("viewer_count", { ascending: false });

      if (error) {
        console.error("Error fetching creators:", error);
        setLoading(false);
        return;
      }

      setCreators(data || []);
      setLoading(false);
    };

    fetchCreators();

    const channel = supabase
      .channel("creator_profiles_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "creator_profiles",
        },
        () => {
          fetchCreators();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const onlineCreators = creators.filter((c) => c.is_streaming);
  const offlineCreators = creators.filter((c) => !c.is_streaming);

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />

      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-pulse text-muted-foreground">
              Carregando criadores...
            </div>
          </div>
        ) : (
          <>
            {onlineCreators.length > 0 && (
              <section className="mb-12">
                <div className="flex items-center gap-2 mb-6">
                  <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                  <h2 className="text-2xl font-bold">Ao Vivo Agora</h2>
                  <span className="text-muted-foreground">
                    ({onlineCreators.length})
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {onlineCreators.map((creator) => (
                    <CreatorCard
                      key={creator.id}
                      id={creator.id}
                      displayName={creator.display_name}
                      bio={creator.bio}
                      tags={creator.tags}
                      isStreaming={creator.is_streaming}
                      viewerCount={creator.viewer_count}
                      avatarUrl={creator.profiles?.avatar_url}
                    />
                  ))}
                </div>
              </section>
            )}

            {offlineCreators.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-6">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-2xl font-bold">Criadores Offline</h2>
                  <span className="text-muted-foreground">
                    ({offlineCreators.length})
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {offlineCreators.map((creator) => (
                    <CreatorCard
                      key={creator.id}
                      id={creator.id}
                      displayName={creator.display_name}
                      bio={creator.bio}
                      tags={creator.tags}
                      isStreaming={creator.is_streaming}
                      viewerCount={creator.viewer_count}
                      avatarUrl={creator.profiles?.avatar_url}
                    />
                  ))}
                </div>
              </section>
            )}

            {creators.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                <Users className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">
                  Nenhum criador ainda
                </h3>
                <p className="text-muted-foreground">
                  Seja o primeiro criador da plataforma!
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Home;
