import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Megaphone, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface PromotionalVideo {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  redirect_url: string | null;
}

interface CarouselItem {
  type: 'promo' | 'skeleton';
  promo?: PromotionalVideo;
}

interface VideoCarouselProps {
  userId?: string | null;
}

// Maximum viewing time per promo video (20 seconds)
const PROMO_VIDEO_MAX_SECONDS = 20;

const VideoCarousel = ({ userId }: VideoCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [promoVideos, setPromoVideos] = useState<PromotionalVideo[]>([]);
  const [promoWatchTime, setPromoWatchTime] = useState(0);
  const [maxVisibleCards, setMaxVisibleCards] = useState<number | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const sessionIdRef = useRef<string>(crypto.randomUUID());

  // Fetch promotional videos and settings
  useEffect(() => {
    const fetchData = async () => {
      // Fetch carousel settings
      const { data: settingsData } = await supabase
        .from('homepage_settings')
        .select('carousel_card_count')
        .eq('id', 'default')
        .single();
      
      if (settingsData) {
        setMaxVisibleCards(settingsData.carousel_card_count);
      } else {
        setMaxVisibleCards(7);
      }
      setSettingsLoaded(true);

      // Fetch only promotional videos
      const { data: promoData } = await supabase
        .from('promotional_videos')
        .select('id, title, description, thumbnail_url, video_url, redirect_url')
        .eq('is_active', true)
        .or('starts_at.is.null,starts_at.lte.now()')
        .or('ends_at.is.null,ends_at.gt.now()')
        .order('position', { ascending: true });
      
      if (promoData) setPromoVideos(promoData);
    };
    fetchData();
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

  // Build carousel items - only promos
  const carouselItems: CarouselItem[] = (() => {
    const items: CarouselItem[] = [];

    promoVideos.forEach((promo) => {
      items.push({ type: 'promo', promo });
    });

    // Pad with skeletons if needed
    const targetCount = maxVisibleCards ?? 7;
    while (items.length < targetCount && items.length < 1) {
      items.push({ type: 'skeleton' });
    }

    return items;
  })();

  const itemCount = carouselItems.length;
  const currentItem = carouselItems[currentIndex];
  const isCurrentPromo = currentItem?.type === 'promo';

  // Reset promo watch time when changing slides
  useEffect(() => {
    setPromoWatchTime(0);
  }, [currentIndex]);

  // Promo video 20-second timer
  useEffect(() => {
    if (!isCurrentPromo) return;

    const currentPromo = currentItem?.promo;
    let watchedSeconds = 0;

    const timer = setInterval(() => {
      watchedSeconds++;
      setPromoWatchTime(watchedSeconds);
      
      if (watchedSeconds >= PROMO_VIDEO_MAX_SECONDS) {
        if (currentPromo) {
          recordPromoView(currentPromo.id, watchedSeconds, true);
        }
        setCurrentIndex(prevIndex => (prevIndex + 1) % itemCount);
      }
    }, 1000);

    return () => {
      clearInterval(timer);
      if (currentPromo && watchedSeconds > 0 && watchedSeconds < PROMO_VIDEO_MAX_SECONDS) {
        recordPromoView(currentPromo.id, watchedSeconds, false);
      }
    };
  }, [isCurrentPromo, itemCount, currentItem, recordPromoView]);

  // Auto-scroll every 5 seconds for skeleton items
  useEffect(() => {
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
    
    const adjustedDiff = normalizedDiff > itemCount / 2 
      ? normalizedDiff - itemCount 
      : normalizedDiff;

    const absDistance = Math.abs(adjustedDiff);
    
    const baseSpacing = isMobile ? 140 : 200;
    const compressionFactor = absDistance >= 2 ? 0.85 : 1;
    const spacing = baseSpacing * compressionFactor;
    
    const translateX = adjustedDiff * spacing;
    const scale = Math.max(0.55, 1 - absDistance * 0.18);
    const zIndex = 10 - absDistance;
    
    const maxVisibleDistance = Math.floor((maxVisibleCards ?? 7) / 2);
    const shouldHide = absDistance > maxVisibleDistance;
    
    return {
      transform: `translateX(${translateX}px) scale(${scale})`,
      zIndex,
      opacity: shouldHide ? 0 : 1,
      pointerEvents: shouldHide ? 'none' as const : 'auto' as const,
      transition: "all 0.5s cubic-bezier(0.25, 0.1, 0.25, 1)",
    };
  };

  const handleVideoClick = (index: number) => {
    const item = carouselItems[index];
    
    if (item.type === 'skeleton') return;
    
    if (index === currentIndex) {
      if (item.type === 'promo' && item.promo?.redirect_url) {
        window.open(item.promo.redirect_url, '_blank');
      }
    } else {
      setCurrentIndex(index);
      setIsAutoPlaying(false);
    }
  };

  // Detect mobile
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Touch/swipe handling
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const isSwiping = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = Math.abs(currentX - touchStartX.current);
    const diffY = Math.abs(currentY - touchStartY.current);
    
    if (diffX > diffY && diffX > 10) {
      isSwiping.current = true;
    }
    
    touchEndX.current = currentX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    
    const diff = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;
    
    if (Math.abs(diff) > minSwipeDistance && isSwiping.current) {
      if (diff > 0) {
        goToNext();
      } else {
        goToPrev();
      }
    }
    
    touchStartX.current = null;
    touchStartY.current = null;
    touchEndX.current = null;
    isSwiping.current = false;
  }, [goToNext, goToPrev]);

  const showArrows = (maxVisibleCards ?? 7) > 1 && itemCount > 1;

  // Don't render until settings loaded
  if (!settingsLoaded) {
    return (
      <div className="relative w-full pt-0 pb-4 overflow-hidden">
        <div className="relative h-[200px] sm:h-[240px] md:h-[280px] flex items-center justify-center">
          <div className="animate-pulse bg-muted rounded-xl w-[200px] sm:w-[320px] h-[140px] sm:h-[200px]" />
        </div>
      </div>
    );
  }

  // Don't render if no promo videos
  if (promoVideos.length === 0) {
    return null;
  }

  return (
    <div className="relative w-full pt-0 pb-4 overflow-hidden">
      {/* Navigation Arrows */}
      {showArrows && (
        <>
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
        </>
      )}

      {/* Carousel Container */}
      <div 
        className="relative h-[200px] sm:h-[240px] md:h-[280px] flex items-center justify-center touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {carouselItems.map((item, index) => {
          const isCenter = index === currentIndex;

          const cardWidth = isMobile ? "200px" : "320px";
          const cardHeight = isCenter 
            ? (isMobile ? "140px" : "200px")
            : (isMobile ? "120px" : "180px");

          return (
            <div
              key={index}
              className={cn(
                "absolute rounded-lg sm:rounded-xl overflow-hidden border-2 transition-all duration-500",
                item.type !== 'skeleton' && "cursor-pointer",
                isCenter 
                  ? "border-yellow-500 shadow-[0_0_20px_hsl(45_100%_50%/0.4)] sm:shadow-[0_0_30px_hsl(45_100%_50%/0.5)]"
                  : "border-border/50"
              )}
              style={{
                ...getItemStyle(index, isMobile),
                width: cardWidth,
                height: cardHeight,
              }}
              onClick={() => handleVideoClick(index)}
              onMouseEnter={() => item.type !== 'skeleton' && setIsAutoPlaying(false)}
              onMouseLeave={() => item.type !== 'skeleton' && setIsAutoPlaying(true)}
            >
              {item.type === 'promo' && item.promo ? (
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

                  {/* 20-second progress bar */}
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
              ) : (
                // Skeleton placeholder
                <div className="w-full h-full bg-card">
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <Megaphone className="w-10 h-10 sm:w-16 sm:h-16 text-muted-foreground/30" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dots indicator */}
      {(maxVisibleCards ?? 7) > 1 && itemCount > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {carouselItems.map((_, index) => (
            <button
              key={index}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-300",
                index === currentIndex
                  ? "bg-yellow-500 w-6"
                  : "bg-muted-foreground/40 hover:bg-muted-foreground/60"
              )}
              onClick={() => {
                setCurrentIndex(index);
                setIsAutoPlaying(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default VideoCarousel;
