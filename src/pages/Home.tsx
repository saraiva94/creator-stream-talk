import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import LivePreviewCard from "@/components/LivePreviewCard";
import UserSearchAutocomplete from "@/components/UserSearchAutocomplete";
import PublicProfileDialog from "@/components/PublicProfileDialog";
import HowToMonetizeDialog from "@/components/affiliate/HowToMonetizeDialog";
import { InstructionsDialog } from "@/components/InstructionsDialog";
import VideoCarousel from "@/components/VideoCarousel";
import LivesGridSkeleton from "@/components/LivesGridSkeleton";
import { useLanguage } from "@/hooks/useLanguage";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import type { LiveSummary } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const Home = () => {
  const [lives, setLives] = useState<LiveSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUsername, setSelectedUsername] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string>("");
  const [displayedCount, setDisplayedCount] = useState(4);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, isLoading: authLoading } = useAuth();
  const isMobile = useIsMobile();

  // Determine display limits based on screen size
  const getDisplayLimits = useCallback(() => {
    if (typeof window === 'undefined') return { initial: 4, step: 4, max: 8 };
    const width = window.innerWidth;
    if (width < 768) return { initial: 4, step: 4, max: 8 }; // Mobile
    if (width < 1024) return { initial: 6, step: 4, max: 12 }; // Tablet
    return { initial: 8, step: 4, max: 16 }; // Desktop
  }, []);

  useEffect(() => {
    const limits = getDisplayLimits();
    setDisplayedCount(limits.initial);
  }, [getDisplayLimits]);

  useEffect(() => {
    fetchLives();
  }, []);

  // Realtime subscription for lives changes - CRITICAL for live updates
  useEffect(() => {
    console.log('[Home] 🚀 Setting up realtime subscriptions...');
    
    const handleLivesChange = (payload: any) => {
      console.log('[Home] 🟢 LIVES REALTIME EVENT:', payload.eventType, payload.new, payload.old);
      // Immediate refresh on any lives table change
      fetchLives();
    };

    const handleCreatorProfilesChange = (payload: any) => {
      console.log('[Home] 🔵 CREATOR_PROFILES REALTIME EVENT:', payload.eventType, payload.new, payload.old);
      // Immediate refresh on any creator_profiles table change
      fetchLives();
    };
    
    const channel = supabase
      .channel('home-live-updates-v2')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'lives'
        },
        handleLivesChange
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'lives'
        },
        handleLivesChange
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'lives'
        },
        handleLivesChange
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'creator_profiles'
        },
        handleCreatorProfilesChange
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'creator_profiles'
        },
        handleCreatorProfilesChange
      )
      .subscribe((status, err) => {
        console.log('[Home] 📡 Realtime subscription status:', status, err || '');
        if (status === 'SUBSCRIBED') {
          console.log('[Home] ✅ Realtime SUBSCRIBED successfully!');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Home] ❌ Realtime CHANNEL_ERROR:', err);
        }
      });

    return () => {
      console.log('[Home] 🔌 Removing realtime channel');
      supabase.removeChannel(channel);
    };
  }, []);

  // Pull-to-refresh handlers for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return;
    touchStartY.current = e.touches[0].clientY;
  }, [isMobile]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isMobile || isRefreshing) return;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    if (scrollTop > 0) return;
    
    const touchY = e.touches[0].clientY;
    const diff = touchY - touchStartY.current;
    
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.5, 100));
    }
  }, [isMobile, isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!isMobile || isRefreshing) return;
    
    if (pullDistance > 60) {
      setIsRefreshing(true);
      await fetchLives();
      setIsRefreshing(false);
    }
    setPullDistance(0);
  }, [isMobile, isRefreshing, pullDistance]);

  // Fetch user's referral code when logged in
  useEffect(() => {
    const fetchReferralCode = async () => {
      if (!user?.id) return;
      try {
        const { data } = await supabase
          .from("profiles")
          .select("referral_code")
          .eq("id", user.id)
          .single();
        if (data?.referral_code) {
          setReferralCode(data.referral_code);
        }
      } catch (err) {
        console.error("Error fetching referral code:", err);
      }
    };
    fetchReferralCode();
  }, [user?.id]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && !hasReachedEnd && !loading) {
          const limits = getDisplayLimits();
          
          if (displayedCount < limits.max) {
            setIsLoadingMore(true);
            
            const loadMore = async () => {
              try {
                // Increase display count based on current lives
                setDisplayedCount(prev => {
                  const newCount = Math.min(prev + limits.step, limits.max);
                  if (newCount >= limits.max || newCount >= lives.length) {
                    setHasReachedEnd(true);
                  }
                  return newCount;
                });
              } catch (err) {
                console.error("Error loading more lives:", err);
                setHasReachedEnd(true);
              } finally {
                setIsLoadingMore(false);
              }
            };
            
            setTimeout(loadMore, 400);
          } else {
            setHasReachedEnd(true);
          }
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [displayedCount, isLoadingMore, hasReachedEnd, loading, lives.length, getDisplayLimits]);

  const fetchLives = async () => {
    console.log('[Home] 📡 Fetching lives from Supabase...');
    try {
      // Fetch ACTIVE lives directly from Supabase (same as sidebar for consistency)
      const { data: activeLives, error: activeError } = await supabase
        .from('lives')
        .select(`
          id, 
          creator_id, 
          title, 
          description, 
          price, 
          status, 
          is_active, 
          room_name, 
          creator_percent, 
          affiliate_percent, 
          platform_percent, 
          created_at, 
          ended_at,
          thumbnail_url
        `)
        .or('and(is_active.eq.true,status.eq.live),status.eq.ended')
        .order('created_at', { ascending: false });

      if (activeError) {
        console.error('[Home] Error fetching lives:', activeError);
        setLives([]);
        return;
      }

      // Get creator usernames and avatars
      const creatorIds = [...new Set(activeLives?.map((l: any) => l.creator_id) || [])];
      let profileMap = new Map<string, { username: string; avatar_url: string | null; display_name: string | null }>();
      
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', creatorIds);

        const { data: creatorProfiles } = await supabase
          .from('creator_profiles')
          .select('id, display_name')
          .in('id', creatorIds);

        const displayNameMap = new Map(creatorProfiles?.map((c: any) => [c.id, c.display_name]) || []);
        
        profiles?.forEach((p: any) => {
          profileMap.set(p.id, {
            username: p.username,
            avatar_url: p.avatar_url,
            display_name: displayNameMap.get(p.id) || null
          });
        });
      }

      // Enrich lives with creator info
      const enrichedLives = (activeLives || []).map((live: any) => ({
        ...live,
        creator_username: profileMap.get(live.creator_id)?.username || null,
        creator_avatar_url: profileMap.get(live.creator_id)?.avatar_url || null,
        creator_display_name: profileMap.get(live.creator_id)?.display_name || null
      }));

      console.log('[Home] ✅ Fetched lives:', enrichedLives.length, 'online:', enrichedLives.filter((l: any) => l.is_active && l.status === 'live').length);
      setLives(enrichedLives);
    } catch (err: unknown) {
      console.error("[Home] Error fetching lives:", err);
      setLives([]);
    } finally {
      setLoading(false);
    }
  };

  // Online lives: is_active = true AND status = 'live'
  const onlineLives = lives.filter((live) => live.is_active === true && live.status === 'live');
  // Offline lives: status = 'ended' or is_active = false
  const offlineLives = lives.filter((live) => live.status === 'ended' || live.is_active === false);

  // Open profile dialog instead of navigating
  const handleUserSelect = (selectedUser: { id: string; username: string }) => {
    setSelectedUserId(selectedUser.id);
    setSelectedUsername(selectedUser.username);
    setProfileDialogOpen(true);
  };

  const handleVideoClick = (live: LiveSummary) => {
    navigate(`/live/${live.id}`);
  };

  return (
    <AppLayout>
      <div 
        ref={containerRef}
        className="container mx-auto px-4 py-4"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull-to-refresh indicator */}
        {isMobile && (pullDistance > 0 || isRefreshing) && (
          <div 
            className="flex items-center justify-center transition-all duration-200"
            style={{ height: isRefreshing ? 50 : pullDistance }}
          >
            <RefreshCw 
              className={`h-6 w-6 text-primary transition-transform ${isRefreshing ? 'animate-spin' : ''}`}
              style={{ transform: `rotate(${pullDistance * 2}deg)` }}
            />
            {pullDistance > 60 && !isRefreshing && (
              <span className="ml-2 text-sm text-muted-foreground">
                {t.home?.releaseToRefresh || "Solte para atualizar"}
              </span>
            )}
          </div>
        )}
        <div className="text-center">
          <div className="max-w-lg mx-auto space-y-3">
            <UserSearchAutocomplete 
              onSelectUser={handleUserSelect}
              placeholder={t.home?.search || "Buscar usuários..."}
            />
            
            {/* Action buttons */}
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <HowToMonetizeDialog 
                userId={user?.id} 
                initialCode={referralCode} 
                onCodeSaved={(newCode) => setReferralCode(newCode)} 
              />
              <InstructionsDialog />
            </div>
          </div>
        </div>

        {/* Video Carousel - promotional videos only */}
        <div className="-mt-4">
          <VideoCarousel userId={user?.id || null} />
        </div>

        {/* Lives Grid Section */}
        <section className="mt-4">
          <h2 className="text-xl md:text-2xl font-bold mb-4 text-primary flex items-center gap-2">
            <span className="w-2.5 h-2.5 md:w-3 md:h-3 bg-success rounded-full animate-pulse"></span>
            {t.home?.onlineNow || "Ao vivo agora"}
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
            {/* Real live cards */}
            {!loading && !authLoading && onlineLives.map((live) => (
              <LivePreviewCard
                key={live.id}
                live={live}
                isLoggedIn={!!user}
                onLoginRequired={() => setShowLoginDialog(true)}
              />
            ))}
            
            {/* Ghost skeleton cards to fill remaining grid slots */}
            <LivesGridSkeleton count={Math.max(0, displayedCount - (loading || authLoading ? 0 : onlineLives.length))} />
          </div>

          {/* Load more trigger */}
          <div ref={loadMoreRef} className="h-10 mt-4 flex items-center justify-center">
            {isLoadingMore && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">{t.home?.loadingMore || "Carregando mais..."}</span>
              </div>
            )}
            {hasReachedEnd && !isLoadingMore && (
              <p className="text-muted-foreground text-sm text-center">
                {t.home?.endOfContent || "Você chegou ao fim! Volte mais tarde para ver novos criadores."}
              </p>
            )}
          </div>
        </section>

        {/* Offline Lives Section */}
        {offlineLives.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xl md:text-2xl font-bold mb-4 text-muted-foreground">
              {t.home?.offline || "Offline"}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
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

        {/* Login Dialog */}
        <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
          <DialogContent className="border-primary/20">
            <DialogHeader>
              <DialogTitle className="text-primary">{t.home?.loginToWatch || "Faça login para assistir"}</DialogTitle>
              <DialogDescription>
                {t.home?.loginDesc || "Create an account or sign in to watch live streams and interact with creators."}
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 mt-4">
              <Button
                className="flex-1"
                onClick={() => navigate("/auth")}
              >
                {t.home?.loginButton || "Entrar"}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowLoginDialog(false)}
              >
                {t.common?.cancel || "Cancel"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Public Profile Dialog */}
        <PublicProfileDialog
          isOpen={profileDialogOpen}
          onClose={() => setProfileDialogOpen(false)}
          userId={selectedUserId}
          username={selectedUsername}
        />
      </div>
    </AppLayout>
  );
};

export default Home;