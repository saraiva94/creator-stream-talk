import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Play, Megaphone, TrendingUp, Users, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LiveSummary } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface PromotionalVideo {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  redirect_url: string | null;
}

interface TopCreator {
  id: string;
  display_name: string;
  bio: string | null;
  viewer_count: number | null;
  is_streaming: boolean | null;
  avatar_url?: string | null;
}

interface CarouselItem {
  type: 'live' | 'promo' | 'creator' | 'skeleton';
  live?: LiveSummary;
  promo?: PromotionalVideo;
  creator?: TopCreator;
  rank?: number;
}

interface VideoCarouselProps {
  lives?: LiveSummary[];
  onVideoClick?: (live: LiveSummary) => void;
  onLoginRequired?: () => void;
  isLoggedIn?: boolean;
  userId?: string | null;
}

// Minimum cards to maintain UI continuity
const MIN_CAROUSEL_ITEMS = 7;
// Maximum viewing time per promo video (20 seconds like live preview)
const PROMO_VIDEO_MAX_SECONDS = 20;

const VideoCarousel = ({ lives = [], onVideoClick, onLoginRequired, isLoggedIn, userId }: VideoCarouselProps) => {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [promoVideos, setPromoVideos] = useState<PromotionalVideo[]>([]);
  const [topCreators, setTopCreators] = useState<TopCreator[]>([]);
  const [promoWatchTime, setPromoWatchTime] = useState(0);
  const [isWatchingPromo, setIsWatchingPromo] = useState(false);
  const sessionIdRef = useRef<string>(crypto.randomUUID());

  // Fetch initial data - only online creators
  useEffect(() => {
    const fetchData = async () => {
      // Fetch promos
      const { data: promoData } = await supabase
        .from('promotional_videos')
        .select('id, title, description, thumbnail_url, video_url, redirect_url')
        .eq('is_active', true)
        .or('starts_at.is.null,starts_at.lte.now()')
        .or('ends_at.is.null,ends_at.gt.now()')
        .order('position', { ascending: true });
      
      if (promoData) setPromoVideos(promoData);

      // Fetch top 10 ONLINE creators by viewer_count (only is_streaming = true)
      const { data: creatorData } = await supabase
        .from('creator_profiles')
        .select('id, display_name, bio, viewer_count, is_streaming')
        .eq('approved_for_live', true)
        .eq('is_streaming', true)
        .order('viewer_count', { ascending: false, nullsFirst: false })
        .limit(10);

      if (creatorData && creatorData.length > 0) {
        // Fetch avatar URLs from profiles
        const creatorIds = creatorData.map(c => c.id);
        const { data: profileData } = await supabase
          .from('public_profiles')
          .select('id, avatar_url')
          .in('id', creatorIds);

        const avatarMap = new Map(profileData?.map(p => [p.id, p.avatar_url]) || []);
        
        const creatorsWithAvatars = creatorData.map(c => ({
          ...c,
          avatar_url: avatarMap.get(c.id) || null
        }));
        
        setTopCreators(creatorsWithAvatars);
      } else {
        setTopCreators([]);
      }
    };
    fetchData();
  }, []);

  // Realtime subscription for creator viewer_count updates - only show online
  useEffect(() => {
    const channel = supabase
      .channel('creator-viewer-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'creator_profiles'
        },
        (payload) => {
          const updated = payload.new as { id: string; viewer_count: number | null; is_streaming: boolean | null };
          
          setTopCreators(prev => {
            // If creator went offline, remove from list
            if (!updated.is_streaming) {
              return prev.filter(c => c.id !== updated.id);
            }
            
            // If creator is online, update or add
            const existingIndex = prev.findIndex(c => c.id === updated.id);
            if (existingIndex >= 0) {
              const updatedList = prev.map(c => 
                c.id === updated.id 
                  ? { ...c, viewer_count: updated.viewer_count, is_streaming: updated.is_streaming }
                  : c
              );
              return [...updatedList].sort((a, b) => (b.viewer_count || 0) - (a.viewer_count || 0));
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Record promo view analytics
  const recordPromoView = useCallback(async (videoId: string, watchDuration: number, completed: boolean) => {
    try {
      await supabase.from('promo_video_views').insert({
        video_id: videoId,
        user_id: userId || null,
        session_id: sessionIdRef.current,
        watch_duration_seconds: watchDuration,
        completed
      });
    } catch (error) {
      console.error('Error recording promo view:', error);
    }
  }, [userId]);

  // Build carousel items - only online creators + promos
  const carouselItems: CarouselItem[] = (() => {
    const items: CarouselItem[] = [];
    let promoIndex = 0;
    let itemCounter = 0;

    // Add lives first
    lives.forEach((live) => {
      items.push({ type: 'live', live });
      itemCounter++;
      
      if (itemCounter % 3 === 0 && promoIndex < promoVideos.length) {
        items.push({ type: 'promo', promo: promoVideos[promoIndex] });
        promoIndex++;
      }
    });

    // Add online top creators with ranking
    topCreators.forEach((creator, index) => {
      items.push({ type: 'creator', creator, rank: index + 1 });
      itemCounter++;
      itemCounter++;
      
      if (itemCounter % 3 === 0 && promoIndex < promoVideos.length) {
        items.push({ type: 'promo', promo: promoVideos[promoIndex] });
        promoIndex++;
      }
    });

    // Add remaining promos
    while (promoIndex < promoVideos.length) {
      items.push({ type: 'promo', promo: promoVideos[promoIndex] });
      promoIndex++;
    }

    // Pad with skeletons to maintain minimum UI continuity
    while (items.length < MIN_CAROUSEL_ITEMS) {
      items.push({ type: 'skeleton' });
    }

    return items;
  })();

  const itemCount = carouselItems.length;

  // Track if current item is a promo video
  const currentItem = carouselItems[currentIndex];
  const isCurrentPromo = currentItem?.type === 'promo';

  // Reset promo watch time when changing slides
  useEffect(() => {
    setPromoWatchTime(0);
    setIsWatchingPromo(isCurrentPromo);
  }, [currentIndex, isCurrentPromo]);

  // Promo video 20-second timer - auto advance after max viewing time
  useEffect(() => {
    if (!isCurrentPromo || !isWatchingPromo) return;

    const currentPromo = currentItem?.promo;
    let watchedSeconds = 0;

    const timer = setInterval(() => {
      watchedSeconds++;
      setPromoWatchTime(watchedSeconds);
      
      if (watchedSeconds >= PROMO_VIDEO_MAX_SECONDS) {
        // Record analytics before advancing
        if (currentPromo) {
          recordPromoView(currentPromo.id, watchedSeconds, true);
        }
        // Auto advance to next after 20 seconds
        setCurrentIndex(prevIndex => (prevIndex + 1) % itemCount);
      }
    }, 1000);

    return () => {
      clearInterval(timer);
      // Record partial view when leaving before completion
      if (currentPromo && watchedSeconds > 0 && watchedSeconds < PROMO_VIDEO_MAX_SECONDS) {
        recordPromoView(currentPromo.id, watchedSeconds, false);
      }
    };
  }, [isCurrentPromo, isWatchingPromo, itemCount, currentItem, recordPromoView]);

  // Auto-scroll every 5 seconds for non-promo items
  useEffect(() => {
    // Don't auto-scroll if watching promo (has its own 20s timer)
    if (!isAutoPlaying || itemCount <= 1 || isCurrentPromo) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % itemCount);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, itemCount, isCurrentPromo]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % itemCount);
    setIsAutoPlaying(false);
  }, [itemCount]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + itemCount) % itemCount);
    setIsAutoPlaying(false);
  }, [itemCount]);

  const getItemStyle = (index: number, isMobile: boolean) => {
    const diff = index - currentIndex;
    const normalizedDiff = ((diff + itemCount) % itemCount);
    
    // Normalize to center around 0
    const adjustedDiff = normalizedDiff > itemCount / 2 
      ? normalizedDiff - itemCount 
      : normalizedDiff;

    const absDistance = Math.abs(adjustedDiff);
    
    // Responsive horizontal spacing
    const spacing = isMobile ? 140 : 220;
    const translateX = adjustedDiff * spacing;
    const scale = Math.max(0.6, 1 - absDistance * 0.15);
    const zIndex = 10 - absDistance;
    
    return {
      transform: `translateX(${translateX}px) scale(${scale})`,
      zIndex,
      opacity: 1,
      transition: "all 0.5s cubic-bezier(0.25, 0.1, 0.25, 1)",
    };
  };

  const handleVideoClick = (index: number) => {
    const item = carouselItems[index];
    
    if (index === currentIndex) {
      if (item.type === 'live' && item.live) {
        if (!isLoggedIn) {
          onLoginRequired?.();
        } else {
          onVideoClick?.(item.live);
        }
      } else if (item.type === 'promo' && item.promo?.redirect_url) {
        window.open(item.promo.redirect_url, '_blank');
      } else if (item.type === 'creator' && item.creator) {
        if (!isLoggedIn) {
          onLoginRequired?.();
        } else {
          navigate(`/creator/${item.creator.id}`);
        }
      }
    } else {
      setCurrentIndex(index);
      setIsAutoPlaying(false);
    }
  };

  // Detect if mobile for responsive sizing
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className="relative w-full py-4 overflow-hidden">

      {/* Navigation Arrows */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute left-1 sm:left-4 top-1/2 -translate-y-1/2 z-20 bg-background/80 hover:bg-background border border-border rounded-full h-8 w-8 sm:h-12 sm:w-12"
        onClick={goToPrev}
      >
        <ChevronLeft className="h-4 w-4 sm:h-6 sm:w-6 text-foreground" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="absolute right-1 sm:right-4 top-1/2 -translate-y-1/2 z-20 bg-background/80 hover:bg-background border border-border rounded-full h-8 w-8 sm:h-12 sm:w-12"
        onClick={goToNext}
      >
        <ChevronRight className="h-4 w-4 sm:h-6 sm:w-6 text-foreground" />
      </Button>

      {/* Carousel Container - Responsive height */}
      <div className="relative h-[200px] sm:h-[240px] md:h-[280px] flex items-center justify-center">
        {carouselItems.map((item, index) => {
          const isCenter = index === currentIndex;

          // Responsive card dimensions
          const cardWidth = isMobile ? "200px" : "320px";
          const cardHeight = isCenter 
            ? (isMobile ? "140px" : "200px")
            : (isMobile ? "120px" : "180px");

          return (
            <div
              key={index}
              className={cn(
                "absolute cursor-pointer rounded-lg sm:rounded-xl overflow-hidden border-2 transition-all duration-500",
                isCenter 
                  ? item.type === 'promo' 
                    ? "border-yellow-500 shadow-[0_0_20px_hsl(45_100%_50%/0.4)] sm:shadow-[0_0_30px_hsl(45_100%_50%/0.5)]"
                    : "border-primary shadow-[0_0_20px_hsl(270_70%_55%/0.4)] sm:shadow-[0_0_30px_hsl(270_70%_55%/0.5)]" 
                  : "border-border/50"
              )}
              style={{
                ...getItemStyle(index, isMobile),
                width: cardWidth,
                height: cardHeight,
              }}
              onClick={() => handleVideoClick(index)}
              onMouseEnter={() => setIsAutoPlaying(false)}
              onMouseLeave={() => setIsAutoPlaying(true)}
            >
              {item.type === 'live' && item.live ? (
                // Live video card
                <div className="relative w-full h-full bg-card">
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                    <Play className="w-8 h-8 sm:w-12 sm:h-12 text-primary/50" />
                  </div>

                  {/* Live badge */}
                  <div className="absolute top-1 left-1 sm:top-2 sm:left-2 flex items-center gap-1 sm:gap-1.5 bg-destructive px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-bold text-white">
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-pulse" />
                    AO VIVO
                  </div>

                  {/* Title overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2 sm:p-3">
                    <p className="text-white font-semibold text-xs sm:text-sm truncate">{item.live.title || "Live"}</p>
                    <p className="text-white/70 text-[10px] sm:text-xs truncate">{item.live.creator_username || "Creator"}</p>
                  </div>

                  {/* Play overlay on center */}
                  {isCenter && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
                      <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-primary/90 flex items-center justify-center">
                        <Play className="w-5 h-5 sm:w-7 sm:h-7 text-white fill-white" />
                      </div>
                    </div>
                  )}
                </div>
              ) : item.type === 'promo' && item.promo ? (
                // Promotional video card
                <div className="relative w-full h-full bg-card">
                  {/* Video embed or thumbnail */}
                  {isCenter && item.promo.video_url ? (
                    item.promo.video_url.includes('youtube.com/embed') ? (
                      <iframe
                        src={item.promo.video_url}
                        className="w-full h-full"
                        allow="autoplay; encrypted-media"
                        allowFullScreen
                        title={item.promo.title}
                      />
                    ) : (
                      <video
                        src={item.promo.video_url}
                        className="w-full h-full object-cover"
                        autoPlay
                        muted
                        loop
                        playsInline
                      />
                    )
                  ) : item.promo.thumbnail_url ? (
                    <img 
                      src={item.promo.thumbnail_url} 
                      alt={item.promo.title} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center">
                      <Megaphone className="w-8 h-8 sm:w-12 sm:h-12 text-yellow-500/50" />
                    </div>
                  )}

                  {/* Promo badge */}
                  <div className="absolute top-1 left-1 sm:top-2 sm:left-2 flex items-center gap-1 sm:gap-1.5 bg-yellow-500 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-bold text-black">
                    <Megaphone className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    <span className="hidden sm:inline">PATROCINADO</span>
                    <span className="sm:hidden">AD</span>
                  </div>

                  {/* 20-second progress bar for center promo */}
                  {isCenter && (
                    <div className="absolute top-0 left-0 right-0 h-0.5 sm:h-1 bg-black/40">
                      <div 
                        className="h-full bg-yellow-500 transition-all duration-1000 ease-linear"
                        style={{ width: `${(promoWatchTime / PROMO_VIDEO_MAX_SECONDS) * 100}%` }}
                      />
                    </div>
                  )}

                  {/* Time remaining indicator */}
                  {isCenter && (
                    <div className="absolute top-1 right-1 sm:top-2 sm:right-2 bg-black/70 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-mono text-white">
                      {PROMO_VIDEO_MAX_SECONDS - promoWatchTime}s
                    </div>
                  )}

                  {/* Title overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2 sm:p-3">
                    <p className="text-white font-semibold text-xs sm:text-sm truncate">{item.promo.title}</p>
                    {item.promo.description && (
                      <p className="text-white/70 text-[10px] sm:text-xs truncate hidden sm:block">{item.promo.description}</p>
                    )}
                  </div>

                  {/* Click overlay for redirect */}
                  {isCenter && item.promo.redirect_url && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-yellow-500/90 flex items-center justify-center">
                        <ExternalLink className="w-5 h-5 sm:w-7 sm:h-7 text-black" />
                      </div>
                    </div>
                  )}
                </div>
              ) : item.type === 'creator' && item.creator ? (
                // Top creator card
                <div className="relative w-full h-full bg-card">
                  {item.creator.avatar_url ? (
                    <img 
                      src={item.creator.avatar_url} 
                      alt={item.creator.display_name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
                      <Users className="w-8 h-8 sm:w-12 sm:h-12 text-emerald-500/50" />
                    </div>
                  )}

                  {/* Ranking badge with smooth animation */}
                  <div 
                    className="absolute top-1 left-1 sm:top-2 sm:left-2 flex items-center gap-1 sm:gap-1.5 bg-gradient-to-r from-emerald-500 to-cyan-500 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-bold text-white transition-all duration-500 ease-out"
                    style={{ 
                      transform: `scale(1)`,
                      animation: 'pulse 2s infinite'
                    }}
                  >
                    <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    <span className="transition-all duration-300">TOP {item.rank}</span>
                  </div>

                  {/* Live indicator if streaming */}
                  {item.creator.is_streaming && (
                    <div className="absolute top-1 right-1 sm:top-2 sm:right-2 flex items-center gap-1 sm:gap-1.5 bg-destructive px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-bold text-white">
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-pulse" />
                      <span className="hidden sm:inline">AO VIVO</span>
                      <span className="sm:hidden">LIVE</span>
                    </div>
                  )}

                  {/* Viewer count */}
                  {(item.creator.viewer_count ?? 0) > 0 && !item.creator.is_streaming && (
                    <div className="absolute top-1 right-1 sm:top-2 sm:right-2 flex items-center gap-1 bg-black/60 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs text-white">
                      <Users className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      {item.creator.viewer_count}
                    </div>
                  )}

                  {/* Title overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2 sm:p-3">
                    <p className="text-white font-semibold text-xs sm:text-sm truncate">{item.creator.display_name}</p>
                    {item.creator.bio && (
                      <p className="text-white/70 text-[10px] sm:text-xs truncate hidden sm:block">{item.creator.bio}</p>
                    )}
                  </div>

                  {/* Hover overlay */}
                  {isCenter && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
                      <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 flex items-center justify-center">
                        <Play className="w-5 h-5 sm:w-7 sm:h-7 text-white fill-white" />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Skeleton placeholder
                <div className="w-full h-full bg-card">
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-full bg-muted-foreground/30 flex items-center justify-center">
                      <Play className="w-5 h-5 sm:w-8 sm:h-8 text-muted-foreground/60" />
                    </div>
                  </div>

                  {/* Skeleton badge */}
                  <div className="absolute top-1 left-1 sm:top-2 sm:left-2 w-12 sm:w-16 h-4 sm:h-5 bg-muted-foreground/30 rounded" />

                  {/* Skeleton title area */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black p-2 sm:p-3 space-y-1 sm:space-y-2">
                    <div className="w-3/4 h-2 sm:h-3 bg-muted-foreground/40 rounded" />
                    <div className="w-1/2 h-1.5 sm:h-2 bg-muted-foreground/30 rounded" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dots indicator */}
      <div className="flex justify-center gap-2 mt-4">
        {Array.from({ length: Math.min(itemCount, 7) }).map((_, index) => (
          <button
            key={index}
            className={cn(
              "w-2 h-2 rounded-full transition-all duration-300",
              index === currentIndex % Math.min(itemCount, 7)
                ? "bg-primary w-6"
                : "bg-muted-foreground/40 hover:bg-muted-foreground/60"
            )}
            onClick={() => {
              setCurrentIndex(index);
              setIsAutoPlaying(false);
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default VideoCarousel;
