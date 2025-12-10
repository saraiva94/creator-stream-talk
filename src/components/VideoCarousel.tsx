import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LiveSummary } from "@/lib/api";

interface VideoCarouselProps {
  lives?: LiveSummary[];
  onVideoClick?: (live: LiveSummary) => void;
  onLoginRequired?: () => void;
  isLoggedIn?: boolean;
}

// Placeholder skeleton data for when no lives are available
const SKELETON_COUNT = 7;

const VideoCarousel = ({ lives = [], onVideoClick, onLoginRequired, isLoggedIn }: VideoCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const hasLives = lives.length > 0;
  const itemCount = hasLives ? lives.length : SKELETON_COUNT;

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
    const opacity = Math.max(0.3, 1 - absDistance * 0.25);
    
    return {
      transform: `translateX(${translateX}px) scale(${scale})`,
      zIndex,
      opacity,
      transition: "all 0.5s cubic-bezier(0.25, 0.1, 0.25, 1)",
    };
  };

  const handleVideoClick = (index: number) => {
    if (index === currentIndex && hasLives) {
      const live = lives[index];
      if (!isLoggedIn) {
        onLoginRequired?.();
      } else {
        onVideoClick?.(live);
      }
    } else {
      setCurrentIndex(index);
      setIsAutoPlaying(false);
    }
  };

  return (
    <div className="relative w-full py-8 overflow-hidden">
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
        {Array.from({ length: itemCount }).map((_, index) => {
          const live = hasLives ? lives[index] : null;
          const isCenter = index === currentIndex;

          return (
            <div
              key={index}
              className={cn(
                "absolute cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-500",
                isCenter 
                  ? "border-primary shadow-[0_0_30px_hsl(270_70%_55%/0.5)]" 
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
              {hasLives && live ? (
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
                    <p className="text-white font-semibold text-sm truncate">{live.title || "Live"}</p>
                    <p className="text-white/70 text-xs truncate">{live.creator_username || "Creator"}</p>
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
              ) : (
                // Skeleton placeholder
                <div className="w-full h-full bg-card animate-pulse">
                  <div className="w-full h-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-muted-foreground/20 flex items-center justify-center">
                      <Play className="w-8 h-8 text-muted-foreground/40" />
                    </div>
                  </div>

                  {/* Skeleton badge */}
                  <div className="absolute top-2 left-2 w-16 h-5 bg-muted-foreground/20 rounded animate-pulse" />

                  {/* Skeleton title area */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 space-y-2">
                    <div className="w-3/4 h-3 bg-muted-foreground/30 rounded animate-pulse" />
                    <div className="w-1/2 h-2 bg-muted-foreground/20 rounded animate-pulse" />
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
