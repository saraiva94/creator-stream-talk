import { useState, useEffect, useRef, useCallback } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/useLanguage";

interface LivesGridSkeletonProps {
  itemCount?: number;
}

const LivesGridSkeleton = ({ itemCount }: LivesGridSkeletonProps) => {
  const [visibleRows, setVisibleRows] = useState(1);
  const [columns, setColumns] = useState(4);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const observerRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();
  
  const MAX_ROWS = 3; // Maximum rows to load (simulating end of content)

  // Calculate columns based on screen size
  useEffect(() => {
    const calculateColumns = () => {
      const width = window.innerWidth;
      
      if (width >= 1280) return 4; // xl
      if (width >= 1024) return 3; // lg
      if (width >= 768) return 2; // md
      return 1; // mobile
    };

    const updateColumns = () => {
      setColumns(calculateColumns());
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  // Infinite scroll observer
  const loadMore = useCallback(() => {
    if (isLoading || !hasMore) return;
    
    setIsLoading(true);
    
    // Simulate loading delay
    setTimeout(() => {
      setVisibleRows(prev => {
        const newRows = prev + 1;
        if (newRows >= MAX_ROWS) {
          setHasMore(false);
        }
        return newRows;
      });
      setIsLoading(false);
    }, 500);
  }, [isLoading, hasMore]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [loadMore, hasMore, isLoading]);

  const totalItems = itemCount || (columns * visibleRows);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {Array.from({ length: totalItems }).map((_, index) => (
          <div
            key={index}
            className={cn(
              "relative rounded-lg overflow-hidden border border-border/50 bg-card",
              "aspect-video cursor-pointer transition-all duration-300",
              "hover:border-primary/50 hover:shadow-[0_0_15px_hsl(270_70%_55%/0.2)]",
              "animate-fade-in"
            )}
            style={{ animationDelay: `${(index % columns) * 50}ms` }}
          >
            {/* Skeleton thumbnail */}
            <div className="w-full h-full bg-gradient-to-br from-muted/30 to-muted/10 flex items-center justify-center">
              <Play className="w-10 h-10 md:w-12 md:h-12 text-muted-foreground/30" />
            </div>

            {/* Skeleton badge */}
            <div className="absolute top-2 left-2">
              <div className="h-5 w-16 bg-muted/40 rounded animate-pulse" />
            </div>

            {/* Skeleton bottom info */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
              <div className="space-y-2">
                <div className="h-4 w-3/4 bg-muted/40 rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-muted/30 rounded animate-pulse" />
              </div>
            </div>

            {/* Skeleton viewer count */}
            <div className="absolute top-2 right-2">
              <div className="h-5 w-12 bg-muted/40 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex justify-center py-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">{t.common?.loading || "Carregando..."}</span>
          </div>
        </div>
      )}

      {/* End of content message */}
      {!hasMore && (
        <div className="flex justify-center py-6">
          <p className="text-sm text-muted-foreground">
            Não há mais conteúdo para carregar
          </p>
        </div>
      )}

      {/* Intersection observer trigger */}
      {hasMore && <div ref={observerRef} className="h-4" />}
    </div>
  );
};

export default LivesGridSkeleton;