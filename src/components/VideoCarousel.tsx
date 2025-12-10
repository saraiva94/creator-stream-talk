import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Play, Megaphone, TrendingUp, Users, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LiveSummary } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

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
  tags?: string[] | null;
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

const VideoCarousel = ({ lives = [], onVideoClick, onLoginRequired, isLoggedIn, userId }: VideoCarouselProps) => {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [promoVideos, setPromoVideos] = useState<PromotionalVideo[]>([]);
  const [topCreators, setTopCreators] = useState<TopCreator[]>([]);
  const [followedTags, setFollowedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  // Fetch initial data
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

      // Fetch top 10 creators by viewer_count
      const { data: creatorData } = await supabase
        .from('creator_profiles')
        .select('id, display_name, bio, viewer_count, is_streaming, tags')
        .eq('approved_for_live', true)
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

        // Extract all unique tags from creators
        const allTags = new Set<string>();
        creatorData.forEach(c => {
          c.tags?.forEach(tag => allTags.add(tag));
        });
        setAvailableTags(Array.from(allTags));
      }

      // Fetch user's followed tags if logged in
      if (userId) {
        const { data: tagData } = await supabase
          .from('user_followed_tags')
          .select('tag')
          .eq('user_id', userId);
        
        if (tagData) setFollowedTags(tagData.map(t => t.tag));
      }
    };
    fetchData();
  }, [userId]);

  // Realtime subscription for creator viewer_count updates
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
          setTopCreators(prev => 
            prev.map(c => 
              c.id === updated.id 
                ? { ...c, viewer_count: updated.viewer_count, is_streaming: updated.is_streaming }
                : c
            ).sort((a, b) => (b.viewer_count || 0) - (a.viewer_count || 0))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Toggle tag follow
  const toggleTagFollow = async (tag: string) => {
    if (!userId) {
      onLoginRequired?.();
      return;
    }

    if (followedTags.includes(tag)) {
      await supabase.from('user_followed_tags').delete().eq('user_id', userId).eq('tag', tag);
      setFollowedTags(prev => prev.filter(t => t !== tag));
    } else {
      await supabase.from('user_followed_tags').insert({ user_id: userId, tag });
      setFollowedTags(prev => [...prev, tag]);
    }
  };

  // Filter creators by followed tags (if any tags followed)
  const filteredCreators = followedTags.length > 0
    ? topCreators.filter(c => c.tags?.some(t => followedTags.includes(t)))
    : topCreators;

  // Build carousel items with minimum count for UI continuity
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

    // Add filtered top creators with ranking
    filteredCreators.forEach((creator, index) => {
      items.push({ type: 'creator', creator, rank: index + 1 });
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

  // Auto-scroll every 5 seconds
  useEffect(() => {
    if (!isAutoPlaying || itemCount <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % itemCount);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, itemCount]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % itemCount);
    setIsAutoPlaying(false);
  }, [itemCount]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + itemCount) % itemCount);
    setIsAutoPlaying(false);
  }, [itemCount]);

  const getItemStyle = (index: number) => {
    const diff = index - currentIndex;
    const normalizedDiff = ((diff + itemCount) % itemCount);
    
    // Normalize to center around 0
    const adjustedDiff = normalizedDiff > itemCount / 2 
      ? normalizedDiff - itemCount 
      : normalizedDiff;

    const absDistance = Math.abs(adjustedDiff);
    
    // Calculate transform and styling based on distance from center
    const translateX = adjustedDiff * 220; // Horizontal spacing
    const scale = Math.max(0.6, 1 - absDistance * 0.15); // Scale decreases with distance
    const zIndex = 10 - absDistance;
    
    return {
      transform: `translateX(${translateX}px) scale(${scale})`,
      zIndex,
      opacity: 1, // Fully opaque
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

  return (
    <div className="relative w-full py-4 overflow-hidden">
      {/* Tags Filter Bar */}
      {availableTags.length > 0 && (
        <div className="flex items-center justify-center gap-2 mb-4 px-16 flex-wrap">
          <Tag className="h-4 w-4 text-muted-foreground" />
          {availableTags.slice(0, 8).map(tag => (
            <Badge
              key={tag}
              variant={followedTags.includes(tag) ? "default" : "outline"}
              className={cn(
                "cursor-pointer transition-all hover:scale-105",
                followedTags.includes(tag) 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-primary/20"
              )}
              onClick={() => toggleTagFollow(tag)}
            >
              {tag}
            </Badge>
          ))}
          {followedTags.length > 0 && (
            <Badge 
              variant="secondary" 
              className="cursor-pointer"
              onClick={() => setFollowedTags([])}
            >
              Limpar filtros
            </Badge>
          )}
        </div>
      )}

      {/* Navigation Arrows */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-background/80 hover:bg-background border border-border rounded-full h-12 w-12"
        onClick={goToPrev}
      >
        <ChevronLeft className="h-6 w-6 text-foreground" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-background/80 hover:bg-background border border-border rounded-full h-12 w-12"
        onClick={goToNext}
      >
        <ChevronRight className="h-6 w-6 text-foreground" />
      </Button>

      {/* Carousel Container */}
      <div className="relative h-[280px] flex items-center justify-center">
        {carouselItems.map((item, index) => {
          const isCenter = index === currentIndex;

          return (
            <div
              key={index}
              className={cn(
                "absolute cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-500",
                isCenter 
                  ? item.type === 'promo' 
                    ? "border-yellow-500 shadow-[0_0_30px_hsl(45_100%_50%/0.5)]"
                    : "border-primary shadow-[0_0_30px_hsl(270_70%_55%/0.5)]" 
                  : "border-border/50"
              )}
              style={{
                ...getItemStyle(index),
                width: "320px",
                height: isCenter ? "200px" : "180px",
              }}
              onClick={() => handleVideoClick(index)}
              onMouseEnter={() => setIsAutoPlaying(false)}
              onMouseLeave={() => setIsAutoPlaying(true)}
            >
              {item.type === 'live' && item.live ? (
                // Live video card
                <div className="relative w-full h-full bg-card">
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                    <Play className="w-12 h-12 text-primary/50" />
                  </div>

                  {/* Live badge */}
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-destructive px-2 py-1 rounded text-xs font-bold text-white">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    AO VIVO
                  </div>

                  {/* Title overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-3">
                    <p className="text-white font-semibold text-sm truncate">{item.live.title || "Live"}</p>
                    <p className="text-white/70 text-xs truncate">{item.live.creator_username || "Creator"}</p>
                  </div>

                  {/* Play overlay on center */}
                  {isCenter && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
                      <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center">
                        <Play className="w-7 h-7 text-white fill-white" />
                      </div>
                    </div>
                  )}
                </div>
              ) : item.type === 'promo' && item.promo ? (
                // Promotional video card
                <div className="relative w-full h-full bg-card">
                  {item.promo.thumbnail_url ? (
                    <img 
                      src={item.promo.thumbnail_url} 
                      alt={item.promo.title} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center">
                      <Megaphone className="w-12 h-12 text-yellow-500/50" />
                    </div>
                  )}

                  {/* Promo badge */}
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-yellow-500 px-2 py-1 rounded text-xs font-bold text-black">
                    <Megaphone className="w-3 h-3" />
                    PATROCINADO
                  </div>

                  {/* Title overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-3">
                    <p className="text-white font-semibold text-sm truncate">{item.promo.title}</p>
                    {item.promo.description && (
                      <p className="text-white/70 text-xs truncate">{item.promo.description}</p>
                    )}
                  </div>

                  {/* Play overlay on center */}
                  {isCenter && item.promo.redirect_url && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
                      <div className="w-14 h-14 rounded-full bg-yellow-500/90 flex items-center justify-center">
                        <Play className="w-7 h-7 text-black fill-black" />
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
                      <Users className="w-12 h-12 text-emerald-500/50" />
                    </div>
                  )}

                  {/* Ranking badge */}
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-cyan-500 px-2 py-1 rounded text-xs font-bold text-white">
                    <TrendingUp className="w-3 h-3" />
                    TOP {item.rank}
                  </div>

                  {/* Live indicator if streaming */}
                  {item.creator.is_streaming && (
                    <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-destructive px-2 py-1 rounded text-xs font-bold text-white">
                      <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      AO VIVO
                    </div>
                  )}

                  {/* Viewer count */}
                  {(item.creator.viewer_count ?? 0) > 0 && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 px-2 py-1 rounded text-xs text-white">
                      <Users className="w-3 h-3" />
                      {item.creator.viewer_count}
                    </div>
                  )}

                  {/* Title overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-3">
                    <p className="text-white font-semibold text-sm truncate">{item.creator.display_name}</p>
                    {item.creator.bio && (
                      <p className="text-white/70 text-xs truncate">{item.creator.bio}</p>
                    )}
                  </div>

                  {/* Hover overlay */}
                  {isCenter && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 flex items-center justify-center">
                        <Play className="w-7 h-7 text-white fill-white" />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Skeleton placeholder
                <div className="w-full h-full bg-card">
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-muted-foreground/30 flex items-center justify-center">
                      <Play className="w-8 h-8 text-muted-foreground/60" />
                    </div>
                  </div>

                  {/* Skeleton badge */}
                  <div className="absolute top-2 left-2 w-16 h-5 bg-muted-foreground/30 rounded" />

                  {/* Skeleton title area */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black p-3 space-y-2">
                    <div className="w-3/4 h-3 bg-muted-foreground/40 rounded" />
                    <div className="w-1/2 h-2 bg-muted-foreground/30 rounded" />
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
