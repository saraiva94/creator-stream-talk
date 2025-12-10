import { useState, useEffect } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface LivesGridSkeletonProps {
  itemCount?: number;
}

const LivesGridSkeleton = ({ itemCount }: LivesGridSkeletonProps) => {
  const [visibleItems, setVisibleItems] = useState(8);

  // Calculate how many items fit based on screen size
  useEffect(() => {
    const calculateVisibleItems = () => {
      const width = window.innerWidth;
      
      // Responsive columns: 1 on mobile, 2 on sm, 3 on lg, 4 on xl
      let columns = 1;
      if (width >= 1280) columns = 4; // xl
      else if (width >= 1024) columns = 3; // lg
      else if (width >= 768) columns = 2; // md
      else columns = 1; // mobile
      
      // Show 2 rows initially
      const rows = 2;
      setVisibleItems(itemCount || columns * rows);
    };

    calculateVisibleItems();
    window.addEventListener('resize', calculateVisibleItems);
    return () => window.removeEventListener('resize', calculateVisibleItems);
  }, [itemCount]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
      {Array.from({ length: visibleItems }).map((_, index) => (
        <div
          key={index}
          className={cn(
            "relative rounded-lg overflow-hidden border border-border/50 bg-card",
            "aspect-video cursor-pointer transition-all duration-300",
            "hover:border-primary/50 hover:shadow-[0_0_15px_hsl(270_70%_55%/0.2)]"
          )}
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
  );
};

export default LivesGridSkeleton;