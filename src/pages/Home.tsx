import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import CreatorCard from "@/components/CreatorCard";
import Navbar from "@/components/Navbar";
import { VideoOverlay } from "@/components/VideoOverlay";
import { Users, Play } from "lucide-react";

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
  const navigate = useNavigate();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showOverlay, setShowOverlay] = useState(false);
  const [featuredCreator, setFeaturedCreator] = useState<Creator | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

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
      
      // Set featured creator (first online creator)
      const featured = data?.find((c) => c.is_streaming) || data?.[0];
      setFeaturedCreator(featured || null);
      
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

  // 10 second preview timer
  useEffect(() => {
    if (!featuredCreator) return;

    const timer = setTimeout(() => {
      setShowOverlay(true);
      if (videoRef.current) {
        videoRef.current.muted = true;
      }
    }, 10000);

    return () => clearTimeout(timer);
  }, [featuredCreator]);

  const handleEnterRoom = () => {
    if (featuredCreator) {
      navigate(`/room/${featuredCreator.id}`);
    }
  };

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
            {/* Featured Live Preview */}
            {featuredCreator && (
              <section className="mb-12">
                <div className="relative aspect-video rounded-lg overflow-hidden bg-secondary border border-border">
                  {/* Video Player Placeholder */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center space-y-4">
                      <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
                        {featuredCreator.profiles?.avatar_url ? (
                          <img
                            src={featuredCreator.profiles.avatar_url}
                            alt={featuredCreator.display_name}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <Play className="h-12 w-12 text-primary" />
                        )}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold mb-1">{featuredCreator.display_name}</h2>
                        <div className="flex items-center justify-center gap-2">
                          <div className="flex items-center gap-1">
                            <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                            <span className="text-sm font-semibold">AO VIVO</span>
                          </div>
                          <span className="text-sm text-muted-foreground">•</span>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            <span className="text-sm">{featuredCreator.viewer_count} espectadores</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Blur overlay after 10 seconds */}
                  {showOverlay && (
                    <div className="absolute inset-0 backdrop-blur-md">
                      <VideoOverlay
                        title="Continue assistindo"
                        description="Entre na sala do criador para continuar assistindo esta live."
                        primaryButtonText="Entrar na sala"
                        onPrimaryClick={handleEnterRoom}
                      />
                    </div>
                  )}
                </div>
              </section>
            )}

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
