import { Card } from "@/components/ui/card";
import { Play } from "lucide-react";

// Skeleton card that matches LivePreviewCard visual pattern
const SkeletonCard = ({ index }: { index: number }) => (
  <Card 
    className="h-full flex flex-col border-border/50 bg-card/50 shadow-sm overflow-hidden opacity-40 blur-[0.3px] animate-fade-in"
    style={{ animationDelay: `${index * 50}ms` }}
  >
    {/* Thumbnail skeleton - matches aspect-video */}
    <div className="relative aspect-video bg-gradient-to-br from-muted/30 via-background to-muted/20 overflow-hidden flex items-center justify-center">
      <Play className="w-10 h-10 text-muted-foreground/30" />
    </div>

    <div className="p-4 flex-1 flex flex-col gap-3">
      {/* Badge and price skeleton */}
      <div className="flex items-center justify-between gap-2">
        <div className="h-5 w-12 bg-muted/40 rounded-full animate-pulse" />
        <div className="h-4 w-10 bg-muted/30 rounded animate-pulse" />
      </div>

      {/* Title and creator skeleton */}
      <div className="space-y-2 flex-1">
        <div className="h-5 w-3/4 bg-muted/40 rounded animate-pulse" />
        <div className="h-3 w-1/2 bg-muted/30 rounded animate-pulse" />
      </div>

      {/* Button skeleton */}
      <div className="h-10 w-full bg-primary/20 rounded-md animate-pulse" />
    </div>
  </Card>
);

interface LivesGridSkeletonProps {
  count?: number;
}

const LivesGridSkeleton = ({ count = 4 }: LivesGridSkeletonProps) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={`skeleton-${index}`} index={index} />
      ))}
    </>
  );
};

export default LivesGridSkeleton;
